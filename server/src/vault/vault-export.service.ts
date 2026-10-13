import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import AdmZip from 'adm-zip';
import PDFDocument from 'pdfkit';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { finished } from 'node:stream/promises';
import type { VaultPaths } from '../common/config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildExportEnvelope, buildFileManifest } from './export-manifest.js';

export const VAULT_PATHS = 'VAULT_PATHS';

type ExportResult = {
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
  downloadUrl: string;
  absolutePath: string;
};

@Injectable()
export class VaultExportService {
  constructor(private readonly prisma: PrismaService, @Inject(VAULT_PATHS) private readonly paths: VaultPaths) {}

  async exportJson(userId: string, now = new Date()): Promise<ExportResult> {
    const envelope = buildExportEnvelope(userId, await this.snapshot(userId), now);
    const content = Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
    return this.writeAtomic(`photo-memory-${stamp(now)}.json`, 'application/json; charset=utf-8', content);
  }

  async exportZip(userId: string, now = new Date()): Promise<ExportResult> {
    const snapshot = await this.snapshot(userId);
    const envelope = buildExportEnvelope(userId, snapshot, now);
    const dataContent = Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
    const files: Array<{ path: string; content: Buffer }> = [{ path: 'data.json', content: dataContent }];
    const warnings: string[] = [];

    for (const media of snapshot.mediaAssets as Array<{ id: string; storagePath: string; mimeType: string }>) {
      try {
        const content = await readFile(join(this.paths.uploads, media.storagePath));
        files.push({ path: `photos/${media.id}${safeExtension(media.storagePath, media.mimeType)}`, content });
      } catch {
        warnings.push(`照片 ${media.id} 的原文件缺失，未写入迁移包`);
      }
    }

    const zip = new AdmZip();
    files.forEach((file) => zip.addFile(file.path, file.content));
    zip.addFile('manifest.json', Buffer.from(`${JSON.stringify(buildFileManifest(files, warnings), null, 2)}\n`, 'utf8'));
    return this.writeAtomic(`photo-memory-${stamp(now)}.zip`, 'application/zip', zip.toBuffer());
  }

  async exportPdf(userId: string, now = new Date()): Promise<ExportResult> {
    const snapshot = await this.snapshot(userId);
    const fontPath = await findChineseFont();
    const fileName = `photo-memory-${stamp(now)}.pdf`;
    await mkdir(this.paths.exports, { recursive: true });
    const temporaryPath = join(this.paths.exports, `.${randomUUID()}.part`);
    const finalPath = join(this.paths.exports, fileName);

    try {
      const document = new PDFDocument({ size: 'A4', margin: 48, info: { Title: '照片记忆本导出' } });
      document.registerFont('Chinese', fontPath);
      document.font('Chinese').fontSize(22).text('照片记忆本');
      document.moveDown(0.4).fontSize(10).fillColor('#66706d').text(`导出时间：${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
      document.moveDown(1.2).fillColor('#25302f');
      const output = createWriteStream(temporaryPath, { flags: 'wx' });
      document.pipe(output);

      for (const memory of snapshot.memories as Array<any>) {
        if (document.y > 650) document.addPage();
        document.font('Chinese').fontSize(15).fillColor('#25302f').text(memory.title || '未命名的瞬间');
        document.fontSize(9).fillColor('#77817d').text(new Date(memory.eventAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
        const media = (snapshot.mediaAssets as Array<any>).find((item) => item.id === memory.mediaId);
        if (media && media.mimeType !== 'image/webp') {
          try { document.image(join(this.paths.uploads, media.storagePath), { fit: [220, 160] }); } catch { /* missing or invalid images do not abort text export */ }
        }
        if (memory.note) document.moveDown(0.4).font('Chinese').fontSize(10).fillColor('#3f4946').text(memory.note);
        const details = [memory.mood, ...(memory.statuses ?? [])].filter(Boolean).join(' · ');
        if (details) document.moveDown(0.3).fontSize(9).fillColor('#6a9495').text(details);
        document.moveDown(1.2);
      }
      document.end();
      await finished(output);
      await rename(temporaryPath, finalPath);
      return this.metadata(fileName, 'application/pdf', finalPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  private async snapshot(userId: string): Promise<Record<string, unknown>> {
    const [mediaAssets, memories, topics, memoryTopics, longTermCopies, longTermCopyMemories, memoryEchoes, echoReflections, echoPreference] = await Promise.all([
      this.prisma.mediaAsset.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.memory.findMany({ where: { userId, deletedAt: null }, orderBy: [{ eventAt: 'asc' }, { id: 'asc' }] }),
      this.prisma.topic.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.memoryTopic.findMany({ where: { memory: { userId, deletedAt: null } }, orderBy: [{ memoryId: 'asc' }, { topicId: 'asc' }] }),
      this.prisma.longTermCopy.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.longTermCopyMemory.findMany({ where: { copy: { userId } }, orderBy: [{ copyId: 'asc' }, { linkedAt: 'asc' }] }),
      this.prisma.memoryEcho.findMany({ where: { userId }, orderBy: [{ echoDate: 'asc' }, { displayOrder: 'asc' }] }),
      this.prisma.echoReflection.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.echoPreference.findUnique({ where: { userId } }),
    ]);
    return { mediaAssets, memories, topics, memoryTopics, longTermCopies, longTermCopyMemories, memoryEchoes, echoReflections, echoPreference };
  }

  private async writeAtomic(fileName: string, mimeType: string, content: Buffer): Promise<ExportResult> {
    await mkdir(this.paths.exports, { recursive: true });
    const temporaryPath = join(this.paths.exports, `.${randomUUID()}.part`);
    const finalPath = join(this.paths.exports, fileName);
    try {
      await writeFile(temporaryPath, content, { flag: 'wx' });
      await rename(temporaryPath, finalPath);
      return this.metadata(fileName, mimeType, finalPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  private async metadata(fileName: string, mimeType: string, absolutePath: string): Promise<ExportResult> {
    const info = await stat(absolutePath);
    const digest = createHash('sha256').update(await readFile(absolutePath)).digest('hex');
    return { fileName, mimeType, size: info.size, sha256: digest, downloadUrl: `/api/vault/files/exports/${encodeURIComponent(fileName)}`, absolutePath };
  }
}

export async function findChineseFont(candidates = [
  'C:\\Windows\\Fonts\\simhei.ttf',
  'C:\\Windows\\Fonts\\simfang.ttf',
  'C:\\Windows\\Fonts\\simkai.ttf',
]): Promise<string> {
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* try the next local font */ }
  }
  throw new ServiceUnavailableException('未找到可用的中文字体，无法生成不会乱码的 PDF');
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function safeExtension(storagePath: string, mimeType: string): string {
  const extension = extname(basename(storagePath)).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) return extension;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}
