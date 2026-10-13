import { describe, expect, it } from 'vitest';
import { redactDatabaseUrl } from '../src/vault/database-url.js';

describe('database URL redaction', () => {
  it('parses IPv6, escaped credentials and schema without returning a password', () => {
    const result = redactDatabaseUrl('postgresql://memory_user:p%40ss%3Aword@[::1]:5433/photo_memory?schema=private');

    expect(result).toEqual({ provider: 'postgresql', host: '::1', port: 5433, database: 'photo_memory', schema: 'private', username: 'm***r' });
    expect(JSON.stringify(result)).not.toContain('p@ss:word');
    expect(JSON.stringify(result)).not.toContain('p%40ss');
  });

  it('rejects non-PostgreSQL and malformed URLs', () => {
    expect(() => redactDatabaseUrl('mysql://user:pass@localhost/db')).toThrow(/PostgreSQL/i);
    expect(() => redactDatabaseUrl('not-a-url')).toThrow(/DATABASE_URL/i);
  });
});
