import { describe, expect, it } from 'vitest';
import { buildExportEnvelope, buildFileManifest } from '../src/vault/export-manifest.js';

describe('photo-memory export manifest', () => {
  it('uses the stable format version and preserves relationship rows', () => {
    const envelope = buildExportEnvelope('local-user', {
      memories: [{ id: 'memory-1', mediaId: 'media-1' }],
      mediaAssets: [{ id: 'media-1', storagePath: 'photo.jpg' }],
      memoryTopics: [{ memoryId: 'memory-1', topicId: 'topic-1' }],
      longTermCopyMemories: [{ copyId: 'copy-1', memoryId: 'memory-1' }],
    }, new Date('2026-10-13T04:00:00.000Z'));

    expect(envelope.formatVersion).toBe('photo-memory-v1');
    expect(envelope.exportedAt).toBe('2026-10-13T04:00:00.000Z');
    expect(envelope.data.memoryTopics).toEqual([{ memoryId: 'memory-1', topicId: 'topic-1' }]);
    expect(envelope.data.longTermCopyMemories).toEqual([{ copyId: 'copy-1', memoryId: 'memory-1' }]);
  });

  it('creates deterministic SHA-256 entries for safe relative paths', () => {
    const manifest = buildFileManifest([
      { path: 'data.json', content: Buffer.from('memory-data') },
      { path: 'photos/media-1.jpg', content: Buffer.from([1, 2, 3]) },
    ]);

    expect(manifest.files[0]).toEqual({
      path: 'data.json',
      size: 11,
      sha256: '301409d873c62d096f9f044934ab859ba1d1f3b2d29559bce893f9ffbe58e196',
    });
    expect(manifest.files[1].path).toBe('photos/media-1.jpg');
    expect(() => buildFileManifest([{ path: '../secret.txt', content: Buffer.from('x') }])).toThrow(/relative/i);
    expect(() => buildFileManifest([{ path: 'C:\\secret.txt', content: Buffer.from('x') }])).toThrow(/relative/i);
  });
});
