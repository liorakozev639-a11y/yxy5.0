import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildExportEnvelope } from '../src/vault/export-manifest.js';
import { VaultImportService } from '../src/vault/vault-import.service.js';

function jsonPackage(title = '海边散步') {
  return Buffer.from(JSON.stringify(buildExportEnvelope('source-user', {
    mediaAssets: [],
    memories: [],
    topics: [{ id: 'topic-1', userId: 'source-user', name: title, color: null, icon: null, isNone: false, suppressLongTermPrompt: false, echoEnabled: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
    memoryTopics: [], longTermCopies: [], longTermCopyMemories: [], memoryEchoes: [], echoReflections: [], echoPreference: null,
  }, new Date('2026-10-13T04:00:00Z'))));
}

function fakePrisma(options: { failRestore?: boolean; existingTopic?: any } = {}) {
  const records: any[] = [];
  const topics: any[] = [];
  if (options.existingTopic) topics.push(options.existingTopic);
  const prisma: any = {
    importRecord: {
      create: vi.fn(async ({ data }: any) => { const row = { ...data, createdAt: new Date(), completedAt: null }; records.push(row); return row; }),
      findFirst: vi.fn(async ({ where }: any) => records.find((item) => item.id === where.id && item.userId === where.userId) ?? null),
      update: vi.fn(async ({ where, data }: any) => { const row = records.find((item) => item.id === where.id); Object.assign(row, data); return row; }),
    },
    mediaAsset: { findUnique: vi.fn(async () => null) },
    memory: { findUnique: vi.fn(async () => null) },
    topic: { findFirst: vi.fn(async ({ where }: any) => topics.find((item) => item.id === where.OR?.[0]?.id || item.name === where.OR?.[1]?.name) ?? null) },
    longTermCopy: { findFirst: vi.fn(async () => null) },
    $transaction: vi.fn(async (callback: any) => {
      if (options.failRestore) throw new Error('database failed');
      const tx = {
        mediaAsset: { create: vi.fn() }, memory: { create: vi.fn() },
        topic: { create: vi.fn(async ({ data }: any) => { topics.push(data); return data; }) },
        memoryTopic: { createMany: vi.fn() }, longTermCopy: { create: vi.fn() }, longTermCopyMemory: { createMany: vi.fn() },
        memoryEcho: { createMany: vi.fn() }, echoReflection: { createMany: vi.fn() }, echoPreference: { upsert: vi.fn() },
      };
      return callback(tx);
    }),
  };
  return { prisma, records, topics };
}

describe('VaultImportService', () => {
  let root: string;
  let paths: any;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'photo-memory-import-'));
    paths = { root, uploads: join(root, 'uploads'), exports: join(root, 'exports'), backups: join(root, 'backups'), temp: join(root, 'temp') };
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('inspects first, persists a controlled package path, then restores safely', async () => {
    const state = fakePrisma();
    const safetyBackup = { exportJson: vi.fn(async () => ({ fileName: 'safety.json' })) };
    const service = new VaultImportService(state.prisma, paths, safetyBackup as never);
    const inspected = await service.inspect('local-user', { originalname: 'backup.json', mimetype: 'application/json', size: jsonPackage().length, buffer: jsonPackage() });
    const restored = await service.restore('local-user', inspected.id);

    expect(inspected.summary.topics).toBe(1);
    expect(inspected.storageLocation).toMatch(/^D:\\yxy5\.0\\data\\temp|photo-memory-import-/);
    expect(safetyBackup.exportJson).toHaveBeenCalled();
    expect(restored.status).toBe('COMPLETED');
    expect(state.topics).toHaveLength(1);
  });

  it('is idempotent when the same topic already exists', async () => {
    const state = fakePrisma();
    const service = new VaultImportService(state.prisma, paths, { exportJson: vi.fn() } as never);
    const first = await service.inspect('local-user', { originalname: 'backup.json', mimetype: 'application/json', size: jsonPackage().length, buffer: jsonPackage() });
    await service.restore('local-user', first.id);
    const second = await service.inspect('local-user', { originalname: 'backup.json', mimetype: 'application/json', size: jsonPackage().length, buffer: jsonPackage() });
    await service.restore('local-user', second.id);

    expect(state.topics).toHaveLength(1);
  });

  it('generates a new id when an imported topic id conflicts with different content', async () => {
    const state = fakePrisma({ existingTopic: { id: 'topic-1', userId: 'local-user', name: '原有主题' } });
    const service = new VaultImportService(state.prisma, paths, { exportJson: vi.fn(async () => ({})) } as never);
    const inspected = await service.inspect('local-user', { originalname: 'backup.json', mimetype: 'application/json', size: jsonPackage().length, buffer: jsonPackage() });
    await service.restore('local-user', inspected.id);

    expect(state.topics).toHaveLength(2);
    expect(state.topics[1].name).toBe('海边散步');
    expect(state.topics[1].id).not.toBe('topic-1');
  });

  it('marks a failed restore and leaves no successful status', async () => {
    const state = fakePrisma({ failRestore: true });
    const service = new VaultImportService(state.prisma, paths, { exportJson: vi.fn(async () => ({})) } as never);
    const inspected = await service.inspect('local-user', { originalname: 'backup.json', mimetype: 'application/json', size: jsonPackage().length, buffer: jsonPackage() });

    await expect(service.restore('local-user', inspected.id)).rejects.toThrow('database failed');
    expect(state.records[0].status).toBe('FAILED');
  });
});
