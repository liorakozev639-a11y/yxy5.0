import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('memory echo Prisma schema', () => {
  const schema = readFileSync(fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)), 'utf8');

  it('persists memory and topic echo controls', () => {
    expect(schema).toContain('echoExcluded Boolean');
    expect(schema).toContain('echoEnabled Boolean');
  });

  it('persists stable daily echo snapshots', () => {
    expect(schema).toContain('model MemoryEcho');
    expect(schema).toContain('comparisonMemoryId String?');
    expect(schema).toContain('sourceTopicId String?');
    expect(schema).toContain('@@unique([userId, echoDate, memoryId])');
    expect(schema).toContain('@@unique([userId, echoDate, displayOrder])');
    expect(schema).toContain('model EchoGeneration');
    expect(schema).toContain('@@id([userId, echoDate])');
  });

  it('persists reflections and user preferences', () => {
    expect(schema).toContain('model EchoReflection');
    expect(schema).toContain('model EchoPreference');
  });
});
