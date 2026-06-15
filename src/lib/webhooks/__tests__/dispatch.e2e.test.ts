import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../../tests/helpers/db";
import { organizationsRepo } from "@/db/repos/organizations";
import { webhooksRepo } from "@/db/repos/webhooks";
import { webhookDeliveriesRepo } from "@/db/repos/webhook-deliveries";
import { jobsRepo } from "@/db/repos/jobs";
import { buildWorkerContext } from "@/lib/worker/context";
import { drainWorker } from "@/lib/worker/worker";
import { dispatchEvent } from "../dispatch";
import { verifySignature } from "../signing";
import { encryptSecret, type Keyring } from "@/lib/crypto/secrets";
import { createId } from "@/lib/utils";

const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 8) } };
const SECRET = "whsec_abc";
const aad = (orgId: string, webhookId: string) => `webhook:${orgId}:${webhookId}:secret`;
const available: Record<string, boolean> = { sqlite: true, postgres: !!process.env.TEST_DATABASE_URL };

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`webhook delivery e2e — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    async function seed() {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const webhooks = webhooksRepo(tdb!.db, tdb!.schema);
      const org = await orgs.create({ name: "A", slug: "a", now: 1 });
      // pre-generate the id so the secret's AAD binds to it, then create once
      const id = createId();
      const hook = await webhooks.create(org.id, {
        id,
        url: "https://hooks.example.com/evaldesk",
        secretCiphertext: encryptSecret(SECRET, keyring, aad(org.id, id)),
        events: ["certificate.signed"],
        now: 1,
      });
      return { org, hook };
    }

    function ctx(opts: { fetchImpl: typeof fetch; resolve?: (h: string) => Promise<string[]> }) {
      return buildWorkerContext({
        db: tdb!.db,
        schema: tdb!.schema,
        keyring,
        fetchImpl: opts.fetchImpl,
        resolve: opts.resolve ?? (async () => ["93.184.216.34"]), // public IP
        now: () => 1_700_000_000_000,
      });
    }

    it("dispatches → delivers → the receiver's signature verifies", async () => {
      const { org } = await seed();
      let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
      const fetchImpl = (async (url: string, init: RequestInit) => {
        captured = { url, headers: init.headers as Record<string, string>, body: init.body as string };
        return new Response("ok", { status: 200 });
      }) as unknown as typeof fetch;

      const worker = ctx({ fetchImpl });
      const ids = await dispatchEvent(
        { webhooks: webhooksRepo(tdb!.db, tdb!.schema), deliveries: webhookDeliveriesRepo(tdb!.db, tdb!.schema), jobs: jobsRepo(tdb!.db, tdb!.schema), now: () => 1_700_000_000_000 },
        org.id,
        "certificate.signed",
        { runId: "run_1", certificateId: "cert_1" },
      );
      expect(ids).toHaveLength(1); // one subscribed webhook

      const processed = await drainWorker(worker);
      expect(processed).toBe(1);

      // the receiver got a signed POST it can verify with its secret
      expect(captured).not.toBeNull();
      const nowSec = 1_700_000_000;
      const v = verifySignature(SECRET, captured!.headers["EvalDesk-Signature"], captured!.body, nowSec);
      expect(v.valid).toBe(true);
      expect(JSON.parse(captured!.body)).toEqual({ event: "certificate.signed", data: { runId: "run_1", certificateId: "cert_1" } });
    });

    it("a non-2xx response marks the delivery failed and is retried by the queue", async () => {
      const { org } = await seed();
      const fetchImpl = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
      const worker = ctx({ fetchImpl });
      await dispatchEvent(
        { webhooks: webhooksRepo(tdb!.db, tdb!.schema), deliveries: webhookDeliveriesRepo(tdb!.db, tdb!.schema), jobs: jobsRepo(tdb!.db, tdb!.schema), now: () => 1_700_000_000_000 },
        org.id,
        "certificate.signed",
        { x: 1 },
      );
      await drainWorker(worker);
      // the job failed → requeued with backoff (still present, not completed)
      const job = await jobsRepo(tdb!.db, tdb!.schema).claim("w", 1_700_000_999_999);
      expect(job?.type).toBe("webhook.deliver");
      expect(job?.lastError).toContain("500");
    });

    it("SSRF guard blocks delivery to a private address", async () => {
      const { org, hook } = await seed();
      const fetchImpl = (async () => new Response("ok", { status: 200 })) as unknown as typeof fetch;
      const worker = ctx({ fetchImpl, resolve: async () => ["169.254.169.254"] }); // cloud metadata IP
      await dispatchEvent(
        { webhooks: webhooksRepo(tdb!.db, tdb!.schema), deliveries: webhookDeliveriesRepo(tdb!.db, tdb!.schema), jobs: jobsRepo(tdb!.db, tdb!.schema), now: () => 1_700_000_000_000 },
        org.id,
        "certificate.signed",
        { x: 1 },
      );
      await drainWorker(worker);
      const deliveries = await webhookDeliveriesRepo(tdb!.db, tdb!.schema).listForWebhook(org.id, hook.id);
      expect(deliveries.length).toBeGreaterThan(0);
      expect(deliveries.every((d) => d.status === "failed")).toBe(true);
    });
  });
}
