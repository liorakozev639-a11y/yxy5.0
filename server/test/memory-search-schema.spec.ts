import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationPath = fileURLToPath(new URL('../prisma/migrations/0007_memory_search_indexes/migration.sql', import.meta.url));
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

describe('memory search database indexes', () => {
  it('enables pg_trgm safely', () => {
    expect(migration).toMatch(/CREATE EXTENSION IF NOT EXISTS pg_trgm/i);
  });

  it('adds trigram indexes for lowercased title and note', () => {
    expect(migration).toMatch(/USING GIN\s*\(lower\("title"\) gin_trgm_ops\)/i);
    expect(migration).toMatch(/USING GIN\s*\(lower\("note"\) gin_trgm_ops\)/i);
  });

  it('adds a GIN index for status containment', () => {
    expect(migration).toMatch(/USING GIN\s*\("statuses"\)/i);
  });
});
