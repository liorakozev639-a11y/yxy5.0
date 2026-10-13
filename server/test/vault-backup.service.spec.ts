import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultBackupService } from '../src/vault/vault-backup.service.js';

function fakePrisma() {
  const records: any[] = [];
  return {
    records,
    prisma: {
      backupRecord: {
        create: vi.fn(async ({ data }: any) => { const row = { id: `backup-${records.length + 1}`, ...data, createdAt: new Date(), completedAt: null }; records.push(row); return row; }),
        update: vi.fn(async ({ where, data }: any) => { const row = records.find((item) => item.id === where.id); Object.assign(row, data); return row; }),
        findMany: vi.fn(async () => records),
        findFirst: vi.fn(async () => records.at(-1) ?? null),
      },
    },
  };
}

describe('VaultBackupService', () => {
  let root: string;
  let paths: any;
  const databaseUrl = 'postgresql://memory_user:s%40fe-secret@localhost:5433/photo_memory?schema=public';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'photo-memory-backup-'));
    paths = { root, uploads: join(root, 'uploads'), exports: join(root, 'exports'), backups: join(root, 'backups with spaces'), temp: join(root, 'temp') };
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('passes pg_dump a safe argument array and records a non-empty successful backup', async () => {
    const state = fakePrisma();
    const runner = vi.fn(async (_file: string, args: string[], env: NodeJS.ProcessEnv) => {
      const output = args.find((arg) => arg.startsWith('--file='))!.slice('--file='.length);
      expect(args).toContain('--dbname=photo_memory');
      expect(args).toContain('--schema=public');
      expect(env.PGPASSWORD).toBe('s@fe-secret');
      await writeFile(output, Buffer.from('PGDMP-safe-backup'));
    });
    const service = new VaultBackupService(state.prisma as never, paths, runner, databaseUrl, 'D:\\pgsql18\\pgsql\\pgAdmin 4\\runtime\\pg_dump.exe');
    const result = await service.create('local-user', new Date('2026-10-13T04:00:00Z'));

    expect(result.status).toBe('COMPLETED');
    expect(result.storagePath).toContain('backups with spaces');
    expect((await readFile(result.storagePath)).length).toBeGreaterThan(0);
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('marks pg_dump failure without persisting or returning the password', async () => {
    const state = fakePrisma();
    const runner = vi.fn(async () => { throw new Error(`connection failed ${databaseUrl}`); });
    const service = new VaultBackupService(state.prisma as never, paths, runner, databaseUrl, 'D:\\path with spaces\\pg_dump.exe');

    await expect(service.create('local-user')).rejects.toThrow(/备份失败/);
    expect(state.records[0].status).toBe('FAILED');
    expect(state.records[0].errorMessage).not.toContain('s@fe-secret');
    expect(state.records[0].errorMessage).not.toContain('s%40fe-secret');
  });

  it('reports only fixed vault paths and their directory sizes', async () => {
    const state = fakePrisma();
    await writeFile(join(root, 'seed.txt'), 'x');
    const service = new VaultBackupService(state.prisma as never, paths, vi.fn(), databaseUrl, 'pg_dump.exe');
    const storage = await service.storage();

    expect(storage.root.path).toBe(root);
    expect(storage.uploads.path).toBe(paths.uploads);
    expect(storage.backups.path).toBe(paths.backups);
    expect(storage.exports.path).toBe(paths.exports);
    expect(Object.values(storage).every((entry: any) => entry.path.startsWith(root))).toBe(true);
  });
});
