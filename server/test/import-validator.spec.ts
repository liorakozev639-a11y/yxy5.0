import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';
import { buildExportEnvelope, buildFileManifest } from '../src/vault/export-manifest.js';
import { inspectImportBuffer, validateArchiveEntryNames } from '../src/vault/import-validator.js';

function validEnvelope() {
  return buildExportEnvelope('source-user', {
    mediaAssets: [{ id: 'media-1', storagePath: 'source.jpg', mimeType: 'image/jpeg' }],
    memories: [{ id: 'memory-1', mediaId: 'media-1', title: '海边' }],
    topics: [{ id: 'topic-1', name: '恋爱' }],
    memoryTopics: [{ memoryId: 'memory-1', topicId: 'topic-1' }],
    longTermCopies: [{ id: 'copy-1', topicId: 'topic-1' }],
    longTermCopyMemories: [{ copyId: 'copy-1', memoryId: 'memory-1' }],
    memoryEchoes: [], echoReflections: [], echoPreference: null,
  }, new Date('2026-10-13T04:00:00Z'));
}

function makeZip(options: { includePhoto?: boolean; corruptHash?: boolean; envelope?: any } = {}) {
  const data = Buffer.from(JSON.stringify(options.envelope ?? validEnvelope()));
  const files = [{ path: 'data.json', content: data }];
  if (options.includePhoto !== false) files.push({ path: 'photos/media-1.jpg', content: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  const manifest = buildFileManifest(files);
  if (options.corruptHash) manifest.files[0].sha256 = '0'.repeat(64);
  const zip = new AdmZip();
  files.forEach((file) => zip.addFile(file.path, file.content));
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)));
  return zip.toBuffer();
}

describe('import validator', () => {
  it('rejects ZIP Slip, drive-letter and entry-count attacks before extraction', () => {
    expect(() => validateArchiveEntryNames(['../secret.txt'])).toThrow(/relative/i);
    expect(() => validateArchiveEntryNames(['C:\\Windows\\secret.txt'])).toThrow(/relative/i);
    expect(() => validateArchiveEntryNames(['a', 'b'], { maxEntries: 1 })).toThrow(/entries/i);
  });

  it('verifies every manifest hash', () => {
    expect(() => inspectImportBuffer(makeZip({ corruptHash: true }), 'backup.zip')).toThrow(/hash/i);
  });

  it('reports missing photos without hiding the preview', () => {
    const result = inspectImportBuffer(makeZip({ includePhoto: false }), 'backup.zip');
    expect(result.summary.memories).toBe(1);
    expect(result.warnings[0]).toMatch(/media-1/);
  });

  it('rejects broken memory-topic and copy relationships', () => {
    const envelope = validEnvelope();
    envelope.data.memoryTopics[0].topicId = 'missing-topic';
    expect(() => inspectImportBuffer(makeZip({ envelope }), 'backup.zip')).toThrow(/relationship/i);
  });

  it('accepts versioned JSON exports for preview', () => {
    const result = inspectImportBuffer(Buffer.from(JSON.stringify(validEnvelope())), 'backup.json');
    expect(result.kind).toBe('json');
    expect(result.summary).toMatchObject({ memories: 1, photos: 1, topics: 1, longTermCopies: 1 });
  });
});
