// ============================================================================
// Signer bootstrap — resolves (or lazily creates) an org's Ed25519 signing key.
// The PUBLIC key lives in signing_keys; the PRIVATE key is envelope-encrypted in
// `secrets` with an AAD bound to the key id (so it can't be relocated). This is
// a composition-root concern (touches secrets + keyring), kept out of the pure
// finalize-and-sign logic which only receives the resolved Signer.
// ============================================================================

import { generateSigningKeyPair } from "./signing";
import { encryptSecret, decryptSecret, type Keyring } from "./secrets";
import type { signingKeysRepo } from "@/db/repos/signing-keys";
import type { secretsRepo } from "@/db/repos/secrets";
import type { Signer } from "@/lib/runner/finalize-sign";

const SECRET_REF = "signing_key";
const SECRET_NAME = "private_pem";
const aad = (orgId: string, keyId: string) => `signing_key:${orgId}:${keyId}:private_pem`;

export interface SignerBootstrapDeps {
  signingKeys: ReturnType<typeof signingKeysRepo>;
  secrets: ReturnType<typeof secretsRepo>;
  keyring: Keyring;
  now: () => number;
}

/** Get the org's active signing key, generating + persisting one on first use. */
export async function resolveOrCreateSigner(deps: SignerBootstrapDeps, orgId: string): Promise<Signer> {
  const existing = await deps.signingKeys.getActive(orgId);
  if (existing) {
    const blob = await deps.secrets.get(orgId, SECRET_REF, existing.id, SECRET_NAME);
    if (!blob) throw new Error(`signing key ${existing.id} has no stored private key`);
    const privateKeyPem = decryptSecret(blob, deps.keyring, aad(orgId, existing.id));
    return { privateKeyPem, publicKeyPem: existing.publicKeyPem, signingKeyId: existing.id };
  }

  const kp = generateSigningKeyPair();
  const key = await deps.signingKeys.create({ orgId, publicKeyPem: kp.publicKeyPem, now: deps.now() });
  await deps.secrets.put({
    orgId,
    refType: SECRET_REF,
    refId: key.id,
    name: SECRET_NAME,
    ciphertext: encryptSecret(kp.privateKeyPem, deps.keyring, aad(orgId, key.id)),
    now: deps.now(),
  });
  return { privateKeyPem: kp.privateKeyPem, publicKeyPem: kp.publicKeyPem, signingKeyId: key.id };
}
