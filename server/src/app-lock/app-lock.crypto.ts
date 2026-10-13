import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const digest = await scrypt(secret, salt, KEY_LENGTH) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${digest.toString('base64url')}`;
}

export async function verifySecret(secret: string, encoded: string): Promise<boolean> {
  const [algorithm, saltValue, digestValue] = encoded.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !digestValue) return false;

  try {
    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(digestValue, 'base64url');
    const actual = await scrypt(secret, salt, expected.length) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createOpaqueSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
