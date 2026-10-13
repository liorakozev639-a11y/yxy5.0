import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CopyLifecycleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type LongTermCopyInput = { name: string; topicId: string; startDate: string; lifecycleStatus?: CopyLifecycleStatus; autoCollectEnabled?: boolean };
export type LongTermCopyUpdateInput = Partial<Omit<LongTermCopyInput, 'topicId'>>;
export type TimelinePage = { items: Array<{ memoryId: string; eventAt: Date; imageUrl: string; title: string; note: string; mood: string; statuses: string[]; topics: Array<{ id: string; name: string }> }>; nextCursor?: string };

@Injectable()
export class LongTermCopiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: LongTermCopyInput, backfill = false) {
    const topic = await this.prisma.topic.findFirst({ where: { id: input.topicId, userId } });
    if (!topic || topic.isNone) throw new BadRequestException('请选择有效主题');
    const existing = await this.prisma.longTermCopy.findFirst({ where: { userId, topicId: input.topicId } });
    if (existing) throw new ConflictException('该主题已经有关联的长期副本');
    const startDate = new Date(input.startDate);
    if (Number.isNaN(startDate.getTime())) throw new BadRequestException('开始日期无效');
    let copy;
    try {
      copy = await this.prisma.$transaction(async (tx) => {
        const created = await tx.longTermCopy.create({ data: { userId, name: input.name.trim(), topicId: input.topicId, startDate, lifecycleStatus: input.lifecycleStatus ?? 'ACTIVE', autoCollectEnabled: input.autoCollectEnabled ?? true } });
        if (backfill) await this.backfillInTransaction(tx, userId, created.id, input.topicId, startDate);
        return created;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new ConflictException('该主题已经有关联的长期副本');
      throw error;
    }
    return this.get(userId, copy.id);
  }

  list(userId: string) {
    return this.prisma.longTermCopy.findMany({ where: { userId }, include: { topic: true, coverMedia: true }, orderBy: { startDate: 'desc' } });
  }

  async get(userId: string, id: string) {
    const copy = await this.prisma.longTermCopy.findFirst({ where: { id, userId }, include: { topic: true, coverMedia: true } });
    if (!copy) throw new NotFoundException('长期副本不存在');
    return copy;
  }

  async update(userId: string, id: string, input: LongTermCopyUpdateInput) {
    await this.get(userId, id);
    const startDate = input.startDate ? new Date(input.startDate) : undefined;
    if (startDate && Number.isNaN(startDate.getTime())) throw new BadRequestException('开始日期无效');
    const data: any = { ...(input.name ? { name: input.name.trim() } : {}), ...(startDate ? { startDate } : {}), ...(input.lifecycleStatus ? { lifecycleStatus: input.lifecycleStatus } : {}), ...(input.autoCollectEnabled !== undefined ? { autoCollectEnabled: input.autoCollectEnabled } : {}) };
    return this.prisma.longTermCopy.update({ where: { id }, data, include: { topic: true, coverMedia: true } });
  }

  async remove(userId: string, id: string) {
    await this.get(userId, id);
    await this.prisma.longTermCopy.delete({ where: { id } });
    return { ok: true };
  }

  async backfill(userId: string, id: string) {
    const copy = await this.get(userId, id);
    await this.prisma.$transaction((tx) => this.backfillInTransaction(tx, userId, copy.id, copy.topicId, copy.startDate));
    return this.get(userId, id);
  }

  async timeline(userId: string, id: string, page: { cursor?: string; pageSize?: number }): Promise<TimelinePage> {
    await this.get(userId, id);
    const pageSize = Math.min(Math.max(Number(page.pageSize) || 30, 1), 50);
    const cursorRow = page.cursor
      ? await this.prisma.longTermCopyMemory.findUnique({ where: { copyId_memoryId: { copyId: id, memoryId: page.cursor } }, select: { memory: { select: { eventAt: true } } } })
      : undefined;
    if (page.cursor && !cursorRow) throw new BadRequestException('分页游标无效');
    const cursorEventAt = cursorRow?.memory.eventAt;
    const rows = await this.prisma.longTermCopyMemory.findMany({
      where: {
        copyId: id,
        memory: { deletedAt: null },
        ...(cursorEventAt ? { OR: [
          { memory: { eventAt: { lt: cursorEventAt } } },
          { AND: [{ memory: { eventAt: cursorEventAt } }, { memoryId: { lt: page.cursor } }] },
        ] } : {}),
      },
      include: { memory: { include: { media: true, topics: { include: { topic: true } } } } },
      orderBy: [{ memory: { eventAt: 'desc' } }, { memoryId: 'desc' }],
      take: pageSize + 1,
    });
    const hasNext = rows.length > pageSize;
    const items = rows.slice(0, pageSize).map((row: any) => ({
      memoryId: row.memory.id,
      eventAt: row.memory.eventAt,
      imageUrl: row.memory.media ? `/api/media/${row.memory.media.id}/file` : '',
      title: row.memory.title,
      note: row.memory.note,
      mood: row.memory.mood,
      statuses: row.memory.statuses ?? [],
      topics: (row.memory.topics ?? []).map((item: any) => ({ id: item.topic.id, name: item.topic.name })),
    }));
    return { items, ...(hasNext ? { nextCursor: items.at(-1)?.memoryId } : {}) };
  }

  private async backfillInTransaction(tx: any, userId: string, copyId: string, topicId: string, startDate: Date) {
    const memories = await tx.memory.findMany({ where: { userId, deletedAt: null, eventAt: { gte: startDate }, topics: { some: { topicId } } }, select: { id: true } });
    if (memories.length) await tx.longTermCopyMemory.createMany({ data: memories.map((memory: { id: string }) => ({ copyId, memoryId: memory.id })), skipDuplicates: true });
  }
}

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
}
