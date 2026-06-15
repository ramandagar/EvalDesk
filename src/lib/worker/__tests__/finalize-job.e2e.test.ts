import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { organizationsRepo } from "@/db/repos/organizations";
import { projectsRepo } from "@/db/repos/projects";
import { testCasesRepo } from "@/db/repos/test-cases";
import { runsRepo } from "@/db/repos/runs";
import { runResultsRepo } from "@/db/repos/run-results";
import { rubricsRepo } from "@/db/repos/rubrics";
import { adjudicationsRepo } from "@/db/repos/adjudications";
import { signoffPoliciesRepo } from "@/db/repos/signoff-policies";
import { runSignoffsRepo } from "@/db/repos/run-signoffs";
import { signingKeysRepo } from "@/db/repos/signing-keys";
import { evalCertificatesRepo } from "@/db/repos/eval-certificates";
import { secretsRepo } from "@/db/repos/secrets";
import { buildWorkerContext } from "@/lib/worker/context";
import { drainWorker } from "@/lib/worker/worker";
import { verifyCertificate, type SignedCertificate } from "@/lib/moat/certificate";
import type { Keyring } from "@/lib/crypto/secrets";

const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 5) } };
const noFetch = (async () => new Response("{}")) as unknown as typeof fetch;

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

describe("run.finalize worker job + lazy signer bootstrap", () => {
  it("drains run.finalize → generates the org key, signs, locks the run; cert verifies offline", async () => {
    tdb = await makeSqliteTestDb();
    const now = () => 1000;
    const orgs = organizationsRepo(tdb.db, tdb.schema);
    const projects = projectsRepo(tdb.db, tdb.schema);
    const cases = testCasesRepo(tdb.db, tdb.schema);
    const runs = runsRepo(tdb.db, tdb.schema);
    const runResults = runResultsRepo(tdb.db, tdb.schema);
    const rubrics = rubricsRepo(tdb.db, tdb.schema);
    const adjudications = adjudicationsRepo(tdb.db, tdb.schema);
    const policies = signoffPoliciesRepo(tdb.db, tdb.schema);
    const signoffs = runSignoffsRepo(tdb.db, tdb.schema);
    const signingKeys = signingKeysRepo(tdb.db, tdb.schema);
    const certs = evalCertificatesRepo(tdb.db, tdb.schema);
    const secrets = secretsRepo(tdb.db, tdb.schema);

    const org = await orgs.create({ name: "A", slug: "a", now: 1 });
    const project = await projects.create(org.id, { name: "P", now: 1 });
    const rubric = await rubrics.getOrCreateDefault(org.id, project.id, 1);
    const run = await runs.create(org.id, { projectId: project.id, status: "completed", now: 1 });
    await policies.create(org.id, { projectId: project.id, minReviewers: 1, now: 1 });
    const tc = await cases.create(org.id, { projectId: project.id, title: "t", input: "x", now: 1 });
    const rr = await runResults.create(org.id, { runId: run.id, testCaseId: tc.id, status: "completed", agentResponse: "a", now: 1 });
    await adjudications.upsert(org.id, { runResultId: rr.id, finalLabel: "pass", method: "single-human", rubricVersionId: rubric.id, now: 1 });
    await signoffs.submit(org.id, { runId: run.id, reviewerId: "rev1", decision: "approve", now: 1 });

    const worker = buildWorkerContext({ db: tdb.db, schema: tdb.schema, keyring, fetchImpl: noFetch, now });
    await worker.jobs.enqueue({ orgId: org.id, type: "run.finalize", payload: { runId: run.id }, now: now() });
    const processed = await drainWorker(worker);
    expect(processed).toBe(1);

    // a signing key was lazily generated + its private key stored (encrypted)
    const key = await signingKeys.getActive(org.id);
    expect(key).not.toBeNull();
    expect(await secrets.get(org.id, "signing_key", key!.id, "private_pem")).not.toBeNull();

    // run locked + certificate persisted and OFFLINE-verifiable
    expect((await runs.getInOrg(org.id, run.id))!.status).toBe("signed");
    const row = await certs.getForRun(org.id, run.id);
    expect(row).not.toBeNull();
    const bundle: SignedCertificate = {
      payload: row!.payload as Record<string, unknown>,
      canonicalJson: row!.canonicalJson as string,
      contentHash: row!.contentHash,
      signature: row!.signature,
      signingKeyId: row!.signingKeyId,
      publicKeyPem: row!.publicKeyPem,
      algo: "ed25519",
    };
    expect(verifyCertificate(bundle).valid).toBe(true);
    expect(row!.signingKeyId).toBe(key!.id);

    // re-draining a second finalize job is a no-op (idempotent, already signed)
    await worker.jobs.enqueue({ orgId: org.id, type: "run.finalize", payload: { runId: run.id }, now: now() });
    await drainWorker(worker);
    expect(await certs.getForRun(org.id, run.id)).toMatchObject({ id: row!.id });
  });
});
