// Composition helper (not eval-path): the real bcrypt-backed password hasher.
// Tests inject a fast fake implementing the same PasswordHasher port.
import bcrypt from "bcryptjs";
import type { PasswordHasher } from "./auth-service";

const BCRYPT_ROUNDS = 10;

export const bcryptHasher: PasswordHasher = {
  hash: (pw) => bcrypt.hash(pw, BCRYPT_ROUNDS),
  compare: (pw, hash) => bcrypt.compare(pw, hash),
};
