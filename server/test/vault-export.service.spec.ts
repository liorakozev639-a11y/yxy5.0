import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdmZip from 'adm-zip';
import { findChineseFont, VaultExportService } from '../src/vault/vault-export.service.js';

function fakePrisma() {
  const empty = { findMany: vi.fn(async () => []) };
  return {
    mediaAsset: { findMany: vi.fn(async () => [{ id: 'media-1', userId: 'local-user', storagePath: 'photo.jpg', originalName: '海边.jpg', mimeType: 'image/jpeg', fileSize: 4, width: null, height: null, captureAt: null, captureSource: null, processingStatus: 'READY', createdAt: new Date('2026-10-12') }]) },
    memory: { findMany: vi.fn(async () => [{ id: 'memory-1', userId: 'local-user', mediaId: 'media-1', title: '海边散步', note: '风很温柔', mood: '开心', eventAt: new Date('2026-10-12T04:00:00Z'), timezone: 'Asia/Shanghai', statuses: ['散步'], echoExcluded: false, createdAt: new Date('2026-10-12'), updatedAt: new Date('2026-10-12'), deletedAt: null }]) },
    topic: empty, memoryTopic: { findMany: vi.fn(async () => [{ memoryId: 'memory-1', topicId: 'topic-1' }]) },
    longTermCopy: empty, longTermCopyMemory: empty, memoryEcho: empty, echoReflection: empty,
    echoPreference: { findUnique: vi.fn(async () => null) },
  };
}

describe('VaultExportService', () => {
  let root: string;
  let paths: any;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'photo-memory-export-'));
    paths = { root, uploads: join(root, 'uploads'), exports: join(root, 'exports'), backups: join(root, 'backups'), temp: join(root, 'temp') };
    await mkdir(paths.uploads, { recursive: true });
    await writeFile(join(paths.uploads, 'photo.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('exports a versioned JSON snapshot with relationship data', async () => {
    const service = new VaultExportService(fakePrisma() as never, paths);
    const result = await service.exportJson('local-user', new Date('2026-10-13T04:00:00Z'));
    const body = JSON.parse(await readFile(result.absolutePath, 'utf8'));

    expect(body.formatVersion).toBe('photo-memory-v1');
    expect(body.data.memories[0].title).toBe('海边散步');
    expect(body.data.memoryTopics[0]).toEqual({ memoryId: 'memory-1', topicId: 'topic-1' });
    expect(result.downloadUrl).toMatch(/^\/api\/vault\/files\/exports\//);
  });

  it('exports ZIP data, photos and hashes using relative paths', async () => {
    const service = new VaultExportService(fakePrisma() as never, paths);
    const result = await service.exportZip('local-user', new Date('2026-10-13T04:00:00Z'));
    const zip = new AdmZip(result.absolutePath);
    const names = zip.getEntries().map((entry) => entry.entryName);
    const manifest = JSON.parse(zip.readAsText('manifest.json'));

    expect(names).toContain('data.json');
    expect(names).toContain('photos/media-1.jpg');
    expect(manifest.formatVersion).toBe('photo-memory-v1');
    expect(manifest.files.find((file: any) => file.path === 'photos/media-1.jpg')?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps exporting when a database photo file is missing and records a warning', async () => {
    await rm(join(paths.uploads, 'photo.jpg'));
    const service = new VaultExportService(fakePrisma() as never, paths);
    const result = await service.exportZip('local-user', new Date('2026-10-13T04:00:00Z'));
    const zip = new AdmZip(result.absolutePath);
    const manifest = JSON.parse(zip.readAsText('manifest.json'));

    expect(zip.getEntry('photos/media-1.jpg')).toBeNull();
    expect(manifest.warnings[0]).toMatch(/media-1/);
  });

  it('exports a readable PDF with Chinese text even when the photo cannot be decoded', async () => {
    const service = new VaultExportService(fakePrisma() as never, paths);
    const result = await service.exportPdf('local-user', new Date('2026-10-13T04:00:00Z'));
    const content = await readFile(result.absolutePath);

    expect(content.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(content.length).toBeGreaterThan(1_000);
  });

  it('fails clearly instead of producing a garbled PDF when no Chinese font exists', async () => {
    await expect(findChineseFont([join(root, 'missing-font.ttf')])).rejects.toThrow(/中文字体/);
  });
});
