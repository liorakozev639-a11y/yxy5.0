import { describe, expect, it } from 'vitest';
import { createOpaqueSecret, hashOpaqueToken, hashSecret, verifySecret } from '../src/app-lock/app-lock.crypto.js';

describe('app-lock crypto', () => {
  it('stores a salted scrypt digest instead of plaintext', async () => {
    const encoded = await hashSecret('Only-I-Know-2026');

    expect(encoded).toMatch(/^scrypt\$/);
    expect(encoded).not.toContain('Only-I-Know-2026');
    await expect(verifySecret('Only-I-Know-2026', encoded)).resolves.toBe(true);
    await expect(verifySecret('wrong-password', encoded)).resolves.toBe(false);
  });

  it('creates opaque random values and hashes session tokens deterministically', () => {
    const first = createOpaqueSecret();
    const second = createOpaqueSecret();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(43);
    expect(hashOpaqueToken(first)).toBe(hashOpaqueToken(first));
    expect(hashOpaqueToken(first)).not.toBe(hashOpaqueToken(second));
  });
});
