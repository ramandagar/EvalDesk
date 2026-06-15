// Composition helper (not eval-path): build the encryption Keyring from env.
//   EVALDESK_ENCRYPTION_KEYS = "keyId1:<base64-32B>,keyId2:<base64-32B>"
//   EVALDESK_ACTIVE_KEY_ID   = "keyId1"
// Fail-closed: missing/invalid config throws at startup rather than silently
// running without encryption.
import type { Keyring } from "./secrets";

export function loadKeyringFromEnv(
  env: Record<string, string | undefined> = process.env,
): Keyring {
  const raw = env.EVALDESK_ENCRYPTION_KEYS;
  const activeKeyId = env.EVALDESK_ACTIVE_KEY_ID;
  if (!raw || !activeKeyId) {
    throw new Error(
      "Encryption not configured: set EVALDESK_ENCRYPTION_KEYS and EVALDESK_ACTIVE_KEY_ID",
    );
  }

  const keys: Record<string, Buffer> = {};
  for (const entry of raw.split(",")) {
    const idx = entry.indexOf(":");
    if (idx === -1) throw new Error(`Malformed key entry (expected "id:base64"): ${entry}`);
    const id = entry.slice(0, idx).trim();
    const key = Buffer.from(entry.slice(idx + 1).trim(), "base64");
    if (key.length !== 32) throw new Error(`Key "${id}" must decode to 32 bytes`);
    keys[id] = key;
  }

  if (!keys[activeKeyId]) {
    throw new Error(`EVALDESK_ACTIVE_KEY_ID "${activeKeyId}" not present in EVALDESK_ENCRYPTION_KEYS`);
  }
  return { activeKeyId, keys };
}
