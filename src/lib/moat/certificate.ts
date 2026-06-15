// ============================================================================
// Evaluation certificate — moat feature #4. Builds a backend-agnostic value
// object (epoch-ms integers, reals rounded to 6 dp, nulls/undefined omitted),
// canonicalizes it via RFC 8785, SHA-256s it, and Ed25519-signs it. The ARTIFACT
// OF RECORD is the signed canonical JSON, NOT a PDF — so it is reproducible
// across SQLite/Postgres and Node versions and verifiable OFFLINE with the
// bundled public key (zero callback to evaldesk.dev). Pure of IO.
// ============================================================================

import { canonicalize, canonicalBytes } from "./canonicalize";
import { signBytes, verifyBytes, sha256Hex } from "@/lib/crypto/signing";

export const CERTIFICATE_VERSION = 1 as const;

/** A reviewer attribution snapshot, frozen at sign time (never read live). */
export interface CertificateReviewer {
  reviewerId: string;
  role?: string;
  credentialKind?: string;
  credentialVerified?: boolean;
}

/** The result-level verdict comparison that goes into the record. */
export interface CertificateVerdict {
  runResultId: string;
  finalLabel: string;
  judgeLabel?: string;
  humanLabel?: string;
}

export interface CertificatePayloadInput {
  certVersion?: number;
  orgId: string;
  runId: string;
  projectId: string;
  datasetVersion?: string;
  judgeModel?: string;
  judgePromptHash?: string;
  weightingScheme?: string;
  kappa?: number | null;
  kappaMethod?: string;
  kappaN?: number | null;
  kappaCi?: [number, number] | null;
  agreementPct?: number | null;
  calibrationGap?: number | null;
  reviewers?: CertificateReviewer[];
  verdicts?: CertificateVerdict[];
  signoffPolicy?: { minReviewers?: number; requiredRole?: string };
  /** Control-coverage matrix for a suite-scoped run (HIPAA/RBI/EU-AI-Act). */
  suiteCoverage?: CertificateSuiteCoverage;
  signedAt: number; // epoch-ms
}

export interface CertificateSuiteCoverage {
  suiteId: string;
  version: string;
  regulation?: string;
  compliant: boolean;
  controlsCovered: number;
  controlsTotal: number;
  controls: Array<{ id: string; status: string; passRate: number }>;
}

export interface SignedCertificate {
  payload: Record<string, unknown>;
  canonicalJson: string;
  contentHash: string; // sha256 hex of the canonical bytes
  signature: string; // base64 Ed25519 signature over the canonical bytes
  signingKeyId: string;
  publicKeyPem: string; // bundled for offline verification
  algo: "ed25519";
}

/** Round non-integer numbers to 6 dp; drop null/undefined members. Recursive. */
export function normalizeForCertificate(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("certificate cannot contain a non-finite number");
    return Number.isInteger(value) ? value : Number(value.toFixed(6));
  }
  if (Array.isArray(value)) return value.map((v) => normalizeForCertificate(v) ?? null);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nv = normalizeForCertificate(v);
      if (nv !== undefined) out[k] = nv;
    }
    return out;
  }
  return value;
}

/** Build the normalized, deterministic certificate payload value object. */
export function buildCertificatePayload(input: CertificatePayloadInput): Record<string, unknown> {
  const raw = {
    certVersion: input.certVersion ?? CERTIFICATE_VERSION,
    orgId: input.orgId,
    runId: input.runId,
    projectId: input.projectId,
    datasetVersion: input.datasetVersion,
    judge: {
      model: input.judgeModel,
      promptHash: input.judgePromptHash,
    },
    agreement: {
      kappa: input.kappa,
      method: input.kappaMethod,
      n: input.kappaN,
      ciLo: input.kappaCi ? input.kappaCi[0] : undefined,
      ciHi: input.kappaCi ? input.kappaCi[1] : undefined,
      weightingScheme: input.weightingScheme,
    },
    calibration: {
      agreementPct: input.agreementPct,
      gap: input.calibrationGap,
    },
    reviewers: input.reviewers,
    verdicts: input.verdicts,
    signoffPolicy: input.signoffPolicy,
    suiteCoverage: input.suiteCoverage,
    signedAt: input.signedAt,
  };
  return normalizeForCertificate(raw) as Record<string, unknown>;
}

export interface SignArgs {
  privateKeyPem: string;
  publicKeyPem: string;
  signingKeyId: string;
}

/** Sign a built payload, producing the self-verifiable certificate bundle. */
export function signCertificate(payload: Record<string, unknown>, args: SignArgs): SignedCertificate {
  const canonicalJson = canonicalize(payload);
  const bytes = Buffer.from(canonicalJson, "utf8");
  return {
    payload,
    canonicalJson,
    contentHash: sha256Hex(bytes),
    signature: signBytes(args.privateKeyPem, bytes),
    signingKeyId: args.signingKeyId,
    publicKeyPem: args.publicKeyPem,
    algo: "ed25519",
  };
}

export interface VerifyResult {
  valid: boolean;
  reasons: string[];
}

/**
 * Verify a certificate OFFLINE using only the bundle itself: re-canonicalize the
 * payload, confirm it matches the embedded canonicalJson, recompute the hash,
 * and verify the Ed25519 signature with the bundled public key. No network.
 */
export function verifyCertificate(cert: SignedCertificate): VerifyResult {
  const reasons: string[] = [];
  let canonicalJson: string;
  try {
    canonicalJson = canonicalize(cert.payload);
  } catch (e) {
    return { valid: false, reasons: [`payload not canonicalizable: ${(e as Error).message}`] };
  }
  if (canonicalJson !== cert.canonicalJson) reasons.push("canonical-json-mismatch");

  const bytes = canonicalBytes(cert.payload);
  if (sha256Hex(bytes) !== cert.contentHash) reasons.push("content-hash-mismatch");
  if (!verifyBytes(cert.publicKeyPem, bytes, cert.signature)) reasons.push("bad-signature");

  return { valid: reasons.length === 0, reasons };
}
