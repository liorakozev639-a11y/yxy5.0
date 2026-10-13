import { createHash } from 'node:crypto';
import { posix, win32 } from 'node:path';

export const EXPORT_FORMAT_VERSION = 'photo-memory-v1' as const;

export function buildExportEnvelope(userId: string, data: Record<string, unknown>, now = new Date()) {
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    userId,
    data,
  };
}

export function buildFileManifest(files: Array<{ path: string; content: Buffer }>, warnings: string[] = []) {
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    files: files.map((file) => {
      assertSafeArchivePath(file.path);
      return {
        path: file.path,
        size: file.content.length,
        sha256: createHash('sha256').update(file.content).digest('hex'),
      };
    }),
    warnings,
  };
}

export function assertSafeArchivePath(path: string): void {
  const normalized = path.replaceAll('\\', '/');
  if (!path || posix.isAbsolute(normalized) || win32.isAbsolute(path) || normalized.split('/').includes('..')) {
    throw new Error('Archive paths must be safe relative paths');
  }
}
