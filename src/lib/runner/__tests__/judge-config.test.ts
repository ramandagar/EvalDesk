import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { organizationsRepo } from "@/db/repos/organizations";
import { projectsRepo } from "@/db/repos/projects";
import { secretsRepo } from "@/db/repos/secrets";
import { resolveProjectJudge } from "../judge-config";
import { encryptSecret, type Keyring } from "@/lib/crypto/secrets";

const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 9) } };
let tdb: TestDb;
afterEach(async () => { await tdb.cleanup(); });

async function seed() {
  tdb = await makeSqliteTestDb();
  const orgs = organizationsRepo(tdb.db, tdb.schema);
  const projects = projectsRepo(tdb.db, tdb.schema);
  const secrets = secretsRepo(tdb.db, tdb.schema);
  const org = await orgs.create({ name: "A", slug: "a", now: 1 });
  return { org, projects, secrets };
}

describe("resolveProjectJudge", () => {
  it("uses the per-project judge when configured (decrypts the stored key)", async () => {
    const { org, projects, secrets } = await seed();
    const p = await projects.create(org.id, {
      name: "P", now: 1,
      judgeBaseUrl: "https://api.openai.com/v1", judgeModel: "gpt-4o-mini",
    });
    const key = "sk-judge-xyz";
    await secrets.put({
      orgId: org.id, refType: "project", refId: p.id, name: "judge_api_key",
      ciphertext: encryptSecret(key, keyring, `org:${org.id}:project:${p.id}:judge_api_key`), now: 1,
    });
    const j = await resolveProjectJudge({ projects, secrets, keyring }, org.id, p.id, undefined);
    expect(j).toBeDefined();
    expect(j!.specs[0].model).toBe("gpt-4o-mini");
    // exercise the provider path doesn't throw on construction
    expect(() => j!.provider.complete({ model: "gpt-4o-mini", messages: [] })).not.toThrow();
  });

  it("falls back to the env judge when the project has no judge config", async () => {
    const { org, projects, secrets } = await seed();
    const p = await projects.create(org.id, { name: "P", now: 1 }); // no judge fields
    const fallback = { provider: { name: "env", complete: async () => ({ text: "" }) }, specs: [{ model: "env-model" }] } as never;
    const j = await resolveProjectJudge({ projects, secrets, keyring }, org.id, p.id, fallback);
    expect(j).toBe(fallback);
  });

  it("returns undefined when no project judge AND no fallback (human-only)", async () => {
    const { org, projects, secrets } = await seed();
    const p = await projects.create(org.id, { name: "P", now: 1 });
    const j = await resolveProjectJudge({ projects, secrets, keyring }, org.id, p.id, undefined);
    expect(j).toBeUndefined();
  });

  it("judges with an empty key when baseUrl is set but no key stored (local/Ollama)", async () => {
    const { org, projects, secrets } = await seed();
    const p = await projects.create(org.id, {
      name: "P", now: 1,
      judgeBaseUrl: "http://localhost:11434/v1", judgeModel: "llama3.1",
    });
    const j = await resolveProjectJudge({ projects, secrets, keyring }, org.id, p.id, undefined);
    expect(j).toBeDefined();
    expect(j!.specs[0].model).toBe("llama3.1");
  });
});
