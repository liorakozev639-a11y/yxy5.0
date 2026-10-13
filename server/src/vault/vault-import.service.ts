import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { VaultPaths } from '../common/config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { inspectImportBuffer } from './import-validator.js';
import { VAULT_PATHS, VaultExportService } from './vault-export.service.js';

export type ImportUpload = { originalname: string; mimetype: string; size: number; buffer: Buffer };

@Injectable()
export class VaultImportService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VAULT_PATHS) private readonly paths: VaultPaths,
    private readonly safetyExport: VaultExportService,
  ) {}

  async inspect(userId: string, file?: ImportUpload) {
    if (!file) throw new BadRequestException('请选择 JSON 或 ZIP 文件');
    const inspected = inspectImportBuffer(file.buffer, file.originalname);
    const id = randomUUID();
    const extension = inspected.kind === 'zip' ? '.zip' : '.json';
    const relativePath = join('imports', `${id}${extension}`);
    const absolutePath = join(this.paths.temp, relativePath);
    await mkdir(join(this.paths.temp, 'imports'), { recursive: true });
    await writeFile(absolutePath, file.buffer, { flag: 'wx' });
    try {
      const record = await this.prisma.importRecord.create({
        data: { id, userId, sourceType: inspected.kind.toUpperCase(), status: 'PENDING', storagePath: relativePath, summary: { ...inspected.summary, warnings: inspected.warnings } },
      });
      return { id: record.id, status: record.status, summary: inspected.summary, warnings: inspected.warnings, storageLocation: absolutePath };
    } catch (error) {
      await rm(absolutePath, { force: true });
      throw error;
    }
  }

  async restore(userId: string, id: string) {
    const record = await this.prisma.importRecord.findFirst({ where: { id, userId } });
    if (!record?.storagePath) throw new NotFoundException('导入预览不存在');
    if (record.status === 'COMPLETED') return { id, status: 'COMPLETED', result: record.summary };
    const absolutePath = join(this.paths.temp, record.storagePath);
    const inspected = inspectImportBuffer(await readFile(absolutePath), extname(record.storagePath) === '.zip' ? 'backup.zip' : 'backup.json');
    await this.prisma.importRecord.update({ where: { id }, data: { status: 'RUNNING', errorMessage: null } });

    try {
      await this.safetyExport.exportJson(userId, new Date());
      const result = await this.merge(userId, inspected);
      await this.prisma.importRecord.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date(), summary: { ...inspected.summary, warnings: inspected.warnings, result } } });
      return { id, status: 'COMPLETED', result, warnings: inspected.warnings };
    } catch (error) {
      await this.prisma.importRecord.update({ where: { id }, data: { status: 'FAILED', errorMessage: safeError(error), completedAt: new Date() } });
      throw error;
    }
  }

  private async merge(userId: string, inspected: ReturnType<typeof inspectImportBuffer>) {
    const data: any = inspected.envelope.data;
    const topicMap = new Map<string, string>();
    const mediaMap = new Map<string, string>();
    const memoryMap = new Map<string, string>();
    const copyMap = new Map<string, string>();
    const echoMap = new Map<string, string>();
    const created = { topics: 0, photos: 0, memories: 0, longTermCopies: 0, echoes: 0, reflections: 0 };
    const stagedFiles: string[] = [];

    const topics = [] as any[];
    for (const source of data.topics) {
      const existing = await this.prisma.topic.findFirst({ where: { userId, OR: [{ id: source.id }, { name: source.name }] } });
      if (existing && existing.name === source.name) { topicMap.set(source.id, existing.id); continue; }
      const targetId = existing && existing.id === source.id ? randomUUID() : source.id;
      topicMap.set(source.id, targetId);
      topics.push({ ...source, id: targetId, userId, createdAt: toDate(source.createdAt), updatedAt: toDate(source.updatedAt) });
    }

    const media = [] as any[];
    for (const source of data.mediaAssets) {
      const existing = await this.prisma.mediaAsset.findUnique({ where: { id: source.id } });
      const targetId = existing ? (sameRecord(existing, source, ['originalName', 'mimeType', 'fileSize']) ? existing.id : randomUUID()) : source.id;
      mediaMap.set(source.id, targetId);
      if (existing && targetId === existing.id) continue;
      const photoEntry = [...inspected.files.entries()].find(([path]) => path.startsWith(`photos/${source.id}.`));
      const extension = photoEntry ? extname(photoEntry[0]) : safeMediaExtension(source.mimeType);
      const storagePath = `${targetId}${extension}`;
      if (photoEntry) {
        await mkdir(this.paths.uploads, { recursive: true });
        const targetPath = join(this.paths.uploads, storagePath);
        await writeFile(targetPath, photoEntry[1], { flag: 'wx' });
        stagedFiles.push(targetPath);
      }
      media.push({ ...source, id: targetId, userId, storagePath, captureAt: toOptionalDate(source.captureAt), createdAt: toDate(source.createdAt) });
    }

    const memories = [] as any[];
    for (const source of data.memories) {
      const existing = await this.prisma.memory.findUnique({ where: { id: source.id } });
      const targetId = existing ? (sameRecord(existing, source, ['title', 'note', 'mood', 'eventAt']) ? existing.id : randomUUID()) : source.id;
      memoryMap.set(source.id, targetId);
      if (existing && targetId === existing.id) continue;
      memories.push({ ...source, id: targetId, userId, mediaId: mediaMap.get(source.mediaId), eventAt: toDate(source.eventAt), createdAt: toDate(source.createdAt), updatedAt: toDate(source.updatedAt), deletedAt: null });
    }

    const copies = [] as any[];
    for (const source of data.longTermCopies) {
      const topicId = topicMap.get(source.topicId)!;
      const existing = await this.prisma.longTermCopy.findFirst({ where: { userId, topicId } });
      const targetId = existing?.id ?? source.id;
      copyMap.set(source.id, targetId);
      if (existing) continue;
      copies.push({ ...source, id: targetId, userId, topicId, coverMediaId: source.coverMediaId ? mediaMap.get(source.coverMediaId) : null, startDate: toDate(source.startDate), createdAt: toDate(source.createdAt), updatedAt: toDate(source.updatedAt), completedAt: toOptionalDate(source.completedAt), archivedAt: toOptionalDate(source.archivedAt) });
    }

    try {
      await this.prisma.$transaction(async (tx: any) => {
        for (const item of topics) { await tx.topic.create({ data: item }); created.topics += 1; }
        for (const item of media) { await tx.mediaAsset.create({ data: item }); created.photos += 1; }
        for (const item of memories) { await tx.memory.create({ data: item }); created.memories += 1; }
        for (const item of copies) { await tx.longTermCopy.create({ data: item }); created.longTermCopies += 1; }
        if (data.memoryTopics.length) await tx.memoryTopic.createMany({ data: data.memoryTopics.map((link: any) => ({ memoryId: memoryMap.get(link.memoryId), topicId: topicMap.get(link.topicId) })), skipDuplicates: true });
        if (data.longTermCopyMemories.length) await tx.longTermCopyMemory.createMany({ data: data.longTermCopyMemories.map((link: any) => ({ copyId: copyMap.get(link.copyId), memoryId: memoryMap.get(link.memoryId), linkedAt: toDate(link.linkedAt) })), skipDuplicates: true });
        const echoes = [] as any[];
        for (const source of data.memoryEchoes) {
          const existing = await tx.memoryEcho.findUnique({ where: { id: source.id } });
          const targetId = existing ? existing.id : source.id;
          echoMap.set(source.id, targetId);
          if (!existing) echoes.push({ ...source, id: targetId, userId, memoryId: memoryMap.get(source.memoryId), comparisonMemoryId: source.comparisonMemoryId ? memoryMap.get(source.comparisonMemoryId) : null, longTermCopyId: source.longTermCopyId ? copyMap.get(source.longTermCopyId) : null, sourceTopicId: source.sourceTopicId ? topicMap.get(source.sourceTopicId) : null, echoDate: toDate(source.echoDate), viewedAt: toOptionalDate(source.viewedAt), createdAt: toDate(source.createdAt) });
        }
        if (echoes.length) { await tx.memoryEcho.createMany({ data: echoes, skipDuplicates: true }); created.echoes += echoes.length; }
        const reflections = data.echoReflections.filter((source: any) => !source.memoryEchoId || echoMap.has(source.memoryEchoId)).map((source: any) => ({ ...source, userId, memoryId: memoryMap.get(source.memoryId), memoryEchoId: source.memoryEchoId ? echoMap.get(source.memoryEchoId) : null, sourceEchoDate: toDate(source.sourceEchoDate), createdAt: toDate(source.createdAt), updatedAt: toDate(source.updatedAt) }));
        if (reflections.length) { await tx.echoReflection.createMany({ data: reflections, skipDuplicates: true }); created.reflections += reflections.length; }
        if (data.echoPreference) await tx.echoPreference.upsert({ where: { userId }, create: { ...data.echoPreference, userId, createdAt: toDate(data.echoPreference.createdAt), updatedAt: toDate(data.echoPreference.updatedAt) }, update: { enabled: data.echoPreference.enabled, excludedMoods: data.echoPreference.excludedMoods ?? [] } });
      });
      return created;
    } catch (error) {
      await Promise.all(stagedFiles.map((path) => rm(path, { force: true })));
      throw error;
    }
  }
}

function sameRecord(existing: any, source: any, keys: string[]) {
  return keys.every((key) => comparable(existing[key], key) === comparable(source[key], key));
}
function comparable(value: any, key: string) {
  if (value == null) return '';
  if (key.endsWith('At')) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return String(value);
}
function toDate(value: any) { return value instanceof Date ? value : new Date(value); }
function toOptionalDate(value: any) { return value ? toDate(value) : null; }
function safeMediaExtension(mimeType: string) { return mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg'; }
function safeError(error: unknown) { return error instanceof Error ? error.message.slice(0, 500) : '导入恢复失败'; }
