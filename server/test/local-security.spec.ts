import { describe, expect, it } from 'vitest';
import { isTrustedLocalOrigin, LOCAL_BIND_HOST } from '../src/common/local-security.js';

describe('local server security boundary', () => {
  it('binds only to loopback and accepts only the local Vite origins', () => {
    expect(LOCAL_BIND_HOST).toBe('127.0.0.1');
    expect(isTrustedLocalOrigin(undefined)).toBe(true);
    expect(isTrustedLocalOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isTrustedLocalOrigin('http://localhost:5173')).toBe(true);
    expect(isTrustedLocalOrigin('https://attacker.example')).toBe(false);
  });
});
