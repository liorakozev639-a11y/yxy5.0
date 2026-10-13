import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const UPLOAD_DIR = 'UPLOAD_DIR';

export type UploadFile = { buffer: Buffer; mimetype: string; originalname: string; size: number };

export type MediaAssetView = {
  id: string;
  userId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  captureAt: Date | null;
  captureSource: string | null;
  processingStatus: string;
  createdAt: Date;
  fileUrl: string;
};

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService, @Inject(UPLOAD_DIR) private readonly uploadDir: string) {}

  async createFromUpload(file: UploadFile | undefined, userId: string): Promise<MediaAssetView> {
    if (!file || !ALLOWED_TYPES.has(file.mimetype)) throw new BadRequestException('只支持图片文件');
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException('图片不能超过 20MB');
    if (!hasExpectedSignature(file.buffer, file.mimetype)) throw new BadRequestException('图片内容与文件类型不匹配');

    await mkdir(this.uploadDir, { recursive: true });
    const extension = this.extensionFor(file.mimetype, file.originalname);
    const storagePath = `${randomUUID()}${extension}`;
    const absolutePath = join(this.uploadDir, storagePath);
    await writeFile(absolutePath, file.buffer);

    try {
      const asset = await this.prisma.mediaAsset.create({
        data: {
          userId,
          storagePath,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          captureSource: null,
          processingStatus: 'READY',
        },
      });
      return this.toView(asset);
    } catch (error) {
      await rm(absolutePath, { force: true });
      throw error;
    }
  }

  async getOwned(userId: string, id: string) {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, userId } });
    if (!asset) throw new NotFoundException('图片不存在');
    return asset;
  }

  async removeUnused(userId: string, id: string) {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, userId }, include: { memory: true, coverForCopies: true } });
    if (!asset) throw new NotFoundException('图片不存在');
    if (asset.memory || asset.coverForCopies.length) throw new ConflictException('图片仍被记忆或长期副本使用');
    await this.prisma.mediaAsset.delete({ where: { id } });
    await rm(this.filePath(asset), { force: true });
    return { ok: true };
  }

  filePath(asset: { storagePath: string }) {
    return join(this.uploadDir, asset.storagePath);
  }

  async getReadablePath(asset: { storagePath: string }) {
    const path = this.filePath(asset);
    try { await access(path); } catch { throw new NotFoundException('照片文件不存在'); }
    return path;
  }

  private extensionFor(mimetype: string, originalName: string) {
    if (mimetype === 'image/png') return '.png';
    if (mimetype === 'image/webp') return '.webp';
    return extname(originalName).toLowerCase() || '.jpg';
  }

  private toView(asset: any): MediaAssetView {
    return { ...asset, fileUrl: `/api/media/${asset.id}/file` };
  }
}

function hasExpectedSignature(buffer: Buffer, mimetype: string) {
  if (mimetype === 'image/jpeg') return buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
  if (mimetype === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimetype === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}
