import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

/**
 * Hashes a plaintext password with scrypt (no external dependency).
 * Stored format: `scrypt$<saltHex>$<hashHex>`.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Verifies a plaintext password against a stored `scrypt$salt$hash` string. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scryptAsync(plain, salt, expected.length)) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
