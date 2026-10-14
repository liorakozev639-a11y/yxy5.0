import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const schemaPath = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));
const migrationPath = fileURLToPath(new URL('../prisma/migrations/0006_emotional_memory_summaries/migration.sql', import.meta.url));
const schema = readFileSync(schemaPath, 'utf8');
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

describe('emotional memory summary schema', () => {
  it('persists summaries, pages, reflections, and reviewed privacy preferences', () => {
    expect(schema).toContain('model MemorySummary');
    expect(schema).toContain('model MemorySummaryPage');
    expect(schema).toContain('model SummaryReflection');
    expect(schema).toContain('model SummaryPreference');
    expect(schema).toMatch(/consentReviewedAt\s+DateTime\?/);
  });

  it('keeps one summary per user period and one page per display position', () => {
    expect(schema).toContain('@@unique([userId, periodType, periodKey])');
    expect(schema).toContain('@@unique([summaryId, displayOrder])');
  });

  it('stores snapshot, generation, editing, and playback state', () => {
    expect(schema).toMatch(/sourceSnapshot\s+Json/);
    expect(schema).toMatch(/sourceHash\s+String/);
    expect(schema).toMatch(/generationMode\s+SummaryGenerationMode/);
    expect(schema).toMatch(/isCompact\s+Boolean\s+@default\(false\)/);
    expect(schema).toMatch(/lastViewedPage\s+Int\s+@default\(0\)/);
    expect(schema).toMatch(/version\s+Int\s+@default\(1\)/);
    expect(schema).toMatch(/originalNarration\s+String\s+@db\.Text/);
    expect(schema).toMatch(/isUserEdited\s+Boolean\s+@default\(false\)/);
  });

  it('separates summary exclusion from memory echo exclusion', () => {
    expect(schema).toMatch(/summaryExcluded\s+Boolean\s+@default\(false\)/);
    expect(schema).toMatch(/echoExcluded\s+Boolean\s+@default\(false\)/);
  });

  it('ships an executable migration with enums, constraints, and cascading children', () => {
    expect(migration).toContain('CREATE TYPE "SummaryPeriodType"');
    expect(migration).toContain('CREATE TYPE "SummaryGenerationStatus"');
    expect(migration).toContain('CREATE TYPE "SummaryGenerationMode"');
    expect(migration).toContain('CREATE TABLE "MemorySummary"');
    expect(migration).toContain('CREATE TABLE "MemorySummaryPage"');
    expect(migration).toContain('CREATE TABLE "SummaryReflection"');
    expect(migration).toContain('CREATE TABLE "SummaryPreference"');
    expect(migration).toContain('ON DELETE CASCADE');
    expect(migration).toContain('MemorySummary_userId_periodType_periodKey_key');
    expect(migration).toContain('MemorySummaryPage_summaryId_displayOrder_key');
  });
});
