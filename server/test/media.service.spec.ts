import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaService } from '../src/media/media.service.js';

describe('MediaService', () => {
  let uploadDir: string;
  let prisma: { mediaAsset: { create: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } };
  let service: MediaService;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'photo-memory-media-'));
    prisma = { mediaAsset: { create: vi.fn(async ({ data }) => ({ id: 'media-1', ...data })), findFirst: vi.fn(), delete: vi.fn(async () => ({})) } };
    service = new MediaService(prisma as never, uploadDir);
  });

  afterEach(async () => rm(uploadDir, { recursive: true, force: true }));

  it('rejects non-image MIME types', async () => {
    await expect(service.createFromUpload({ buffer: Buffer.from('text'), mimetype: 'text/plain', originalname: 'a.txt', size: 4 }, 'local-user')).rejects.toThrow('只支持图片文件');
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('rejects files larger than 20MB', async () => {
    await expect(service.createFromUpload({ buffer: Buffer.alloc(4), mimetype: 'image/jpeg', originalname: 'large.jpg', size: 20 * 1024 * 1024 + 1 }, 'local-user')).rejects.toThrow('图片不能超过 20MB');
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('persists an accepted image and returns its metadata', async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
    const result = await service.createFromUpload({ buffer: bytes, mimetype: 'image/jpeg', originalname: '旅行.jpg', size: bytes.length }, 'local-user');
    expect(result).toMatchObject({ id: 'media-1', userId: 'local-user', mimeType: 'image/jpeg', originalName: '旅行.jpg' });
    expect(await readFile(join(uploadDir, result.storagePath))).toEqual(bytes);
    expect(prisma.mediaAsset.create).toHaveBeenCalledOnce();
  });

  it('rejects a renamed non-image whose MIME type claims JPEG', async () => {
    await expect(service.createFromUpload({ buffer: Buffer.from('not-a-photo'), mimetype: 'image/jpeg', originalname: 'fake.jpg', size: 11 }, 'local-user')).rejects.toThrow('图片内容与文件类型不匹配');
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('removes an uploaded asset only when it is no longer referenced', async () => {
    const storagePath = 'orphan.jpg';
    await writeFile(join(uploadDir, storagePath), Buffer.from([0xff, 0xd8]));
    prisma.mediaAsset.findFirst.mockResolvedValue({ id: 'media-1', userId: 'local-user', storagePath, memory: null, coverForCopies: [] });

    await expect(service.removeUnused('local-user', 'media-1')).resolves.toEqual({ ok: true });
    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'media-1' } });
    await expect(readFile(join(uploadDir, storagePath))).rejects.toThrow();
  });

  it('keeps media that is still attached to a memory', async () => {
    prisma.mediaAsset.findFirst.mockResolvedValue({ id: 'media-1', userId: 'local-user', storagePath: 'used.jpg', memory: { id: 'memory-1' }, coverForCopies: [] });
    await expect(service.removeUnused('local-user', 'media-1')).rejects.toThrow('图片仍被记忆或长期副本使用');
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
  });

  it('returns a controlled not-found error when the stored photo file is missing', async () => {
    await expect(service.getReadablePath({ storagePath: 'missing.jpg' })).rejects.toThrow('照片文件不存在');
  });
});
