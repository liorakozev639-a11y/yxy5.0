import { BadRequestException } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { assertSafeArchivePath, EXPORT_FORMAT_VERSION } from './export-manifest.js';

export const DEFAULT_IMPORT_LIMITS = {
  maxEntries: 5_000,
  maxCompressedBytes: 250 * 1024 * 1024,
  maxUncompressedBytes: 2 * 1024 * 1024 * 1024,
  maxCompressionRatio: 100,
};

type ImportLimits = Partial<typeof DEFAULT_IMPORT_LIMITS>;

export function validateArchiveEntryNames(names: string[], limits: ImportLimits = {}) {
  const applied = { ...DEFAULT_IMPORT_LIMITS, ...limits };
  if (names.length > applied.maxEntries) throw new BadRequestException('Archive has too many entries');
  for (const name of names) assertSafeArchivePath(name);
}

export function inspectImportBuffer(buffer: Buffer, fileName: string, limits: ImportLimits = {}) {
  const applied = { ...DEFAULT_IMPORT_LIMITS, ...limits };
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new BadRequestException('导入文件为空');
  if (buffer.length > applied.maxCompressedBytes) throw new BadRequestException('导入文件过大');
  const extension = extname(fileName).toLowerCase();

  if (extension === '.json') {
    const envelope = parseJson(buffer, 'JSON 数据');
    validateEnvelope(envelope);
    return result('json', envelope, new Map<string, Buffer>(), missingPhotoWarnings(envelope, new Map()));
  }
  if (extension !== '.zip') throw new BadRequestException('只支持 JSON 或 ZIP 迁移包');

  let zip: AdmZip;
  try { zip = new AdmZip(buffer); } catch { throw new BadRequestException('ZIP 文件无法读取'); }
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
  validateArchiveEntryNames(entries.map((entry) => entry.entryName), applied);
  let uncompressedBytes = 0;
  for (const entry of entries) {
    if ((entry.header.flags & 1) === 1) throw new BadRequestException('不支持加密 ZIP');
    uncompressedBytes += entry.header.size;
    if (uncompressedBytes > applied.maxUncompressedBytes) throw new BadRequestException('ZIP uncompressed size exceeds limit');
    if (entry.header.compressedSize > 0 && entry.header.size / entry.header.compressedSize > applied.maxCompressionRatio) {
      throw new BadRequestException('ZIP compression ratio exceeds limit');
    }
  }

  const entryMap = new Map(entries.map((entry) => [entry.entryName.replaceAll('\\', '/'), entry]));
  const manifestEntry = entryMap.get('manifest.json');
  const dataEntry = entryMap.get('data.json');
  if (!manifestEntry || !dataEntry) throw new BadRequestException('ZIP 缺少 manifest.json 或 data.json');
  const manifest = parseJson(manifestEntry.getData(), 'manifest');
  if (manifest.formatVersion !== EXPORT_FORMAT_VERSION || !Array.isArray(manifest.files)) throw new BadRequestException('manifest 版本无效');

  const declared = new Set<string>();
  const files = new Map<string, Buffer>();
  for (const descriptor of manifest.files) {
    if (!descriptor || typeof descriptor.path !== 'string' || typeof descriptor.sha256 !== 'string' || typeof descriptor.size !== 'number') {
      throw new BadRequestException('manifest 文件项无效');
    }
    assertSafeArchivePath(descriptor.path);
    const entry = entryMap.get(descriptor.path);
    if (!entry) throw new BadRequestException(`manifest file missing: ${descriptor.path}`);
    const content = entry.getData();
    if (content.length !== descriptor.size) throw new BadRequestException(`manifest size mismatch: ${descriptor.path}`);
    const hash = createHash('sha256').update(content).digest('hex');
    if (hash !== descriptor.sha256) throw new BadRequestException(`manifest hash mismatch: ${descriptor.path}`);
    declared.add(descriptor.path);
    files.set(descriptor.path, content);
  }
  for (const name of entryMap.keys()) {
    if (name !== 'manifest.json' && !declared.has(name)) throw new BadRequestException(`ZIP contains undeclared file: ${name}`);
  }

  const envelope = parseJson(files.get('data.json')!, 'data.json');
  validateEnvelope(envelope);
  return result('zip', envelope, files, [...(Array.isArray(manifest.warnings) ? manifest.warnings : []), ...missingPhotoWarnings(envelope, files)]);
}

function parseJson(buffer: Buffer, label: string): any {
  try { return JSON.parse(buffer.toString('utf8')); } catch { throw new BadRequestException(`${label} 无法解析`); }
}

function validateEnvelope(envelope: any) {
  if (envelope?.formatVersion !== EXPORT_FORMAT_VERSION || !envelope?.data || typeof envelope.data !== 'object') {
    throw new BadRequestException('导入格式版本无效');
  }
  const data = envelope.data;
  const names = ['mediaAssets', 'memories', 'topics', 'memoryTopics', 'longTermCopies', 'longTermCopyMemories', 'memoryEchoes', 'echoReflections'];
  for (const name of names) if (!Array.isArray(data[name])) throw new BadRequestException(`导入数据缺少 ${name}`);

  const mediaIds = ids(data.mediaAssets);
  const memoryIds = ids(data.memories);
  const topicIds = ids(data.topics);
  const copyIds = ids(data.longTermCopies);
  const echoIds = ids(data.memoryEchoes);
  for (const memory of data.memories) if (!mediaIds.has(memory.mediaId)) relationshipError('memory.mediaId');
  for (const link of data.memoryTopics) if (!memoryIds.has(link.memoryId) || !topicIds.has(link.topicId)) relationshipError('memoryTopics');
  for (const copy of data.longTermCopies) if (!topicIds.has(copy.topicId)) relationshipError('longTermCopy.topicId');
  for (const link of data.longTermCopyMemories) if (!copyIds.has(link.copyId) || !memoryIds.has(link.memoryId)) relationshipError('longTermCopyMemories');
  for (const echo of data.memoryEchoes) {
    if (!memoryIds.has(echo.memoryId) || (echo.comparisonMemoryId && !memoryIds.has(echo.comparisonMemoryId)) || (echo.longTermCopyId && !copyIds.has(echo.longTermCopyId)) || (echo.sourceTopicId && !topicIds.has(echo.sourceTopicId))) relationshipError('memoryEchoes');
  }
  for (const reflection of data.echoReflections) {
    if (!memoryIds.has(reflection.memoryId) || (reflection.memoryEchoId && !echoIds.has(reflection.memoryEchoId))) relationshipError('echoReflections');
  }
}

function ids(rows: any[]): Set<string> {
  const values = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id) throw new BadRequestException('导入记录缺少 id');
    if (values.has(row.id)) throw new BadRequestException(`导入记录 id 重复: ${row.id}`);
    values.add(row.id);
  }
  return values;
}

function relationshipError(name: string): never {
  throw new BadRequestException(`Import relationship is broken: ${name}`);
}

function missingPhotoWarnings(envelope: any, files: Map<string, Buffer>) {
  if (!files.size) return envelope.data.mediaAssets.map((media: any) => `照片 ${media.id} 未包含在导入文件中`);
  return envelope.data.mediaAssets
    .filter((media: any) => ![...files.keys()].some((path) => path.startsWith(`photos/${media.id}.`)))
    .map((media: any) => `照片 ${media.id} 未包含在迁移包中`);
}

function result(kind: 'json' | 'zip', envelope: any, files: Map<string, Buffer>, warnings: string[]) {
  const data = envelope.data;
  return {
    kind,
    envelope,
    files,
    warnings: [...new Set(warnings)],
    summary: {
      memories: data.memories.length,
      photos: data.mediaAssets.length,
      topics: data.topics.length,
      longTermCopies: data.longTermCopies.length,
      echoes: data.memoryEchoes.length,
      reflections: data.echoReflections.length,
    },
  };
}
