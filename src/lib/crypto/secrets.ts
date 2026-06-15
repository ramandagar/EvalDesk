// ============================================================================
// Secret encryption — AES-256-GCM with AAD binding, fail-closed.
//
// Used to encrypt agent API keys (and other secrets) at rest. Properties:
//   - Confidentiality + integrity (GCM auth tag): any tampering fails decryption.
//   - AAD binding: the ciphertext is bound to a context string (e.g.
//     "org:<id>:agentApiKey"), so a blob cannot be moved between rows/columns.
//   - Key rotation: each blob records the key id it was sealed with; a keyring
//     can hold multiple keys so old blobs decrypt while new writes use the
//     active key (re-wrap on read).
//   - Fail-closed: wrong key, unknown key id, tamper, or malformed input all
//     throw — never return partial/garbage plaintext.
//
// Blob format (all url-safe, ":"-delimited; base64 of binary parts never
// contains ":"):  v1:<keyId>:<iv_b64>:<tag_b64>:<ciphertext_b64>
// ============================================================================

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export interface Keyring {
  activeKeyId: string;
  keys: Record<string, Buffer>; // keyId -> 32-byte key
}

function requireKey(keyring: Keyring, keyId: string): Buffer {
  const key = keyring.keys[keyId];
  if (!key) throw new Error(`secrets: unknown key id "${keyId}" (rotation/escrow issue)`);
  if (key.length !== KEY_BYTES) throw new Error(`secrets: key "${keyId}" must be 32 bytes`);
  return key;
}

export function encryptSecret(plaintext: string, keyring: Keyring, aad: string): string {
  if (keyring.activeKeyId.includes(":")) throw new Error("secrets: key id must not contain ':'");
  const key = requireKey(keyring, keyring.activeKeyId);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    keyring.activeKeyId,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(blob: string, keyring: Keyring, aad: string): string {
  const parts = blob.split(":");
  if (parts.length !== 5 || parts[0] !== VERSION) {
    throw new Error("secrets: malformed ciphertext");
  }
  const [, keyId, ivB64, tagB64, ctB64] = parts;
  const key = requireKey(keyring, keyId);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(), // throws on auth failure (wrong key / tamper / AAD mismatch)
  ]);
  return plaintext.toString("utf8");
}

/** True if a blob was sealed with a non-active key and should be re-encrypted. */
export function needsRewrap(blob: string, keyring: Keyring): boolean {
  const keyId = blob.split(":")[1];
  return keyId !== undefined && keyId !== keyring.activeKeyId;
}
