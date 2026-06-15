import { and, eq } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Immutable, Ed25519-signed evaluation certificate — one per finalized run.
// The signed artifact of record is `canonical_json` + `signature`; the bundled
// `public_key_pem` makes it offline-verifiable with zero callback. Insert is
// idempotent on run_id (re-signing a finalized run is a no-op).

export interface EvalCertificate {
  id: string;
  orgId: string;
  runId: string;
  contentHash: string;
  signature: string;
  signingKeyId: string;
  algo: string;
  publicKeyPem: string;
  canonicalJson: string | null;
  payload: unknown | null;
  weightingScheme: string | null;
  isPublic: boolean;
  signedAt: number;
  expiresAt: number | null;
}

export interface InsertCertificateInput {
  runId: string;
  contentHash: string;
  signature: string;
  signingKeyId: string;
  publicKeyPem: string;
  signedAt: number;
  algo?: string;
  canonicalJson?: string | null;
  payload?: unknown | null;
  weightingScheme?: string | null;
  isPublic?: boolean;
  expiresAt?: number | null;
  id?: string;
}

export function evalCertificatesRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.evalCertificates;

  return {
    async insertIdempotent(orgId: string, input: InsertCertificateInput): Promise<{ cert: EvalCertificate; inserted: boolean }> {
      const inserted = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          runId: input.runId,
          contentHash: input.contentHash,
          signature: input.signature,
          signingKeyId: input.signingKeyId,
          algo: input.algo ?? "ed25519",
          publicKeyPem: input.publicKeyPem,
          canonicalJson: input.canonicalJson ?? null,
          payload: input.payload ?? null,
          weightingScheme: input.weightingScheme ?? null,
          isPublic: input.isPublic ?? false,
          signedAt: input.signedAt,
          expiresAt: input.expiresAt ?? null,
        })
        .onConflictDoNothing({ target: t.runId })
        .returning();
      if (inserted.length) return { cert: inserted[0] as EvalCertificate, inserted: true };
      const [existing] = await db.select().from(t).where(and(eq(t.orgId, orgId), eq(t.runId, input.runId)));
      return { cert: existing as EvalCertificate, inserted: false };
    },

    async getForRun(orgId: string, runId: string): Promise<EvalCertificate | null> {
      const [row] = await db.select().from(t).where(and(eq(t.orgId, orgId), eq(t.runId, runId)));
      return (row as EvalCertificate) ?? null;
    },

    /** Public fetch by id for the offline-verify / shareable cert page. */
    async getById(id: string): Promise<EvalCertificate | null> {
      const [row] = await db.select().from(t).where(eq(t.id, id));
      return (row as EvalCertificate) ?? null;
    },
  };
}
