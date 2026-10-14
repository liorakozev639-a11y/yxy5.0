import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type MemoryInput = {
  mediaId: string;
  title?: string;
  note?: string;
  mood?: string;
  eventAt?: string;
  timezone?: string;
  statuses?: string[];
  topics?: string[];
};

export type MemoryFilter = {
  keyword?: string;
  topicId?: string;
  status?: string;
  from?: string;
  to?: string;
  cursor?: string;
  pageSize?: number;
};

export type MemoryView = {
  id: string;
  userId: string;
  mediaId: string;
  imageUrl: string;
  title: string;
  note: string;
  mood: string;
  eventAt: Date;
  timezone: string;
  statuses: string[];
  topicIds: string[];
  topics: Array<{ id: string; name: string }>;
  createdAt: Date;
  updatedAt: Date;
  echoExcluded: boolean;
  summaryExcluded: boolean;
};

@Injectable()
export class MemoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: MemoryInput): Promise<MemoryView> {
    return this.prisma.$transaction(async (tx) => {
      const media = await tx.mediaAsset.findFirst({ where: { id: input.mediaId, userId } });
      if (!media) throw new NotFoundException('图片不存在');

      const topicIds = uniqueValues(input.topics);
      const topics = topicIds.length
        ? await tx.topic.findMany({ where: { id: { in: topicIds }, userId } })
        : [];
      if (topics.length !== topicIds.length) throw new BadRequestException('包含无效主题');

      const statuses = uniqueValues(input.statuses);
      const title = input.title?.trim() ?? '';
      const note = input.note?.trim() ?? '';
      const mood = input.mood?.trim() ?? '';
      const eventAt = input.eventAt ? new Date(input.eventAt) : media.captureAt ?? new Date();
      if (Number.isNaN(eventAt.getTime())) throw new BadRequestException('发生时间无效');
      const memory = await tx.memory.create({
        data: {
          userId,
          mediaId: input.mediaId,
          title,
          note,
          mood,
          eventAt,
          timezone: input.timezone ?? 'Asia/Shanghai',
          statuses,
          topics: { create: topicIds.map((topicId) => ({ topic: { connect: { id: topicId } } })) },
        },
        include: { media: true, topics: { include: { topic: true } } },
      });

      const activeCopies = topicIds.length
        ? await tx.longTermCopy.findMany({ where: { userId, topicId: { in: topicIds }, lifecycleStatus: 'ACTIVE', autoCollectEnabled: true } })
        : [];
      if (activeCopies.length) {
        await tx.longTermCopyMemory.createMany({
          data: activeCopies.map((copy: { id: string }) => ({ copyId: copy.id, memoryId: memory.id })),
          skipDuplicates: true,
        });
      }
      return this.toView(memory);
    });
  }

  async list(userId: string, filter: MemoryFilter): Promise<{ items: MemoryView[]; nextCursor?: string }> {
    const pageSize = clampPageSize(filter.pageSize);
    const where: any = { userId, deletedAt: null };
    if (filter.topicId) where.topics = { some: { topicId: filter.topicId } };
    if (filter.status) where.statuses = { has: filter.status };
    if (filter.from || filter.to) where.eventAt = { ...(filter.from ? { gte: new Date(filter.from) } : {}), ...(filter.to ? { lte: new Date(filter.to) } : {}) };
    if (filter.keyword?.trim()) {
      const keyword = filter.keyword.trim();
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { note: { contains: keyword, mode: 'insensitive' } },
        { mood: { contains: keyword, mode: 'insensitive' } },
        { statuses: { has: keyword } },
        { topics: { some: { topic: { name: { contains: keyword, mode: 'insensitive' } } } } },
      ];
    }
    const rows = await this.prisma.memory.findMany({
      where,
      include: { media: true, topics: { include: { topic: true } } },
      orderBy: [{ eventAt: 'desc' }, { id: 'desc' }],
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
      take: pageSize + 1,
    });
    const hasNext = rows.length > pageSize;
    const items = rows.slice(0, pageSize).map((row: any) => this.toView(row));
    return { items, ...(hasNext ? { nextCursor: items.at(-1)?.id } : {}) };
  }

  async get(userId: string, id: string) {
    const memory = await this.prisma.memory.findFirst({ where: { id, userId, deletedAt: null }, include: { media: true, topics: { include: { topic: true } } } });
    if (!memory) throw new NotFoundException('记忆不存在');
    return this.toView(memory);
  }

  async update(userId: string, id: string, input: Omit<MemoryInput, 'mediaId'> & { mediaId?: string }) {
    const current = await this.prisma.memory.findFirst({ where: { id, userId, deletedAt: null }, include: { topics: true } });
    if (!current) throw new NotFoundException('记忆不存在');
    const topicIds = input.topics === undefined
      ? (current.topics ?? []).map((item: { topicId: string }) => item.topicId)
      : uniqueValues(input.topics);
    if (input.mediaId) {
      const media = await this.prisma.mediaAsset.findFirst({ where: { id: input.mediaId, userId } });
      if (!media) throw new NotFoundException('图片不存在');
    }
    const topics = topicIds.length ? await this.prisma.topic.findMany({ where: { id: { in: topicIds }, userId } }) : [];
    if (topics.length !== topicIds.length) throw new BadRequestException('包含无效主题');
    const title = input.title === undefined ? current.title : input.title.trim();
    const note = input.note === undefined ? current.note : input.note.trim();
    const mood = input.mood === undefined ? current.mood : input.mood.trim();
    const statuses = input.statuses ? uniqueValues(input.statuses) : current.statuses;
    const eventAt = input.eventAt ? new Date(input.eventAt) : current.eventAt;
    if (Number.isNaN(eventAt.getTime())) throw new BadRequestException('发生时间无效');
    const updated = await this.prisma.$transaction(async (tx) => {
      const memory = await tx.memory.update({ where: { id }, data: { ...(input.mediaId ? { mediaId: input.mediaId } : {}), eventAt, title, note, mood, statuses } });
      if (input.topics !== undefined) {
        await tx.memoryTopic.deleteMany({ where: { memoryId: id } });
        if (topicIds.length) await tx.memoryTopic.createMany({ data: topicIds.map((topicId) => ({ memoryId: id, topicId })), skipDuplicates: true });
      }
      await tx.longTermCopyMemory.deleteMany({
        where: topicIds.length
          ? { memoryId: id, copy: { topicId: { notIn: topicIds } } }
          : { memoryId: id },
      });
      const activeCopies = topicIds.length
        ? await tx.longTermCopy.findMany({ where: { userId, topicId: { in: topicIds }, lifecycleStatus: 'ACTIVE', autoCollectEnabled: true } })
        : [];
      if (activeCopies.length) {
        await tx.longTermCopyMemory.createMany({
          data: activeCopies.map((copy: { id: string }) => ({ copyId: copy.id, memoryId: id })),
          skipDuplicates: true,
        });
      }
      return memory;
    });
    return this.get(userId, updated.id);
  }

  async remove(userId: string, id: string) {
    const current = await this.prisma.memory.findFirst({ where: { id, userId, deletedAt: null } });
    if (!current) throw new NotFoundException('记忆不存在');
    await this.prisma.memory.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async setEchoExcluded(userId: string, id: string, echoExcluded: boolean) {
    const current = await this.prisma.memory.findFirst({ where: { id, userId, deletedAt: null } });
    if (!current) throw new NotFoundException('记忆不存在');
    return this.prisma.memory.update({ where: { id }, data: { echoExcluded } });
  }

  async setSummaryExcluded(userId: string, id: string, summaryExcluded: boolean) {
    const current = await this.prisma.memory.findFirst({ where: { id, userId, deletedAt: null } });
    if (!current) throw new NotFoundException('记忆不存在');
    return this.prisma.memory.update({ where: { id }, data: { summaryExcluded } });
  }

  private toView(memory: any): MemoryView {
    const topics = (memory.topics ?? []).map((item: any) => ({ id: item.topic?.id ?? item.topicId, name: item.topic?.name ?? '' }));
    return {
      id: memory.id,
      userId: memory.userId,
      mediaId: memory.mediaId,
      imageUrl: memory.media ? `/api/media/${memory.media.id}/file` : '',
      title: memory.title ?? '',
      note: memory.note,
      mood: memory.mood ?? '',
      eventAt: memory.eventAt,
      timezone: memory.timezone,
      statuses: memory.statuses ?? [],
      topicIds: topics.map((topic: { id: string }) => topic.id),
      topics,
      echoExcluded: memory.echoExcluded ?? false,
      summaryExcluded: memory.summaryExcluded ?? false,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
  }
}

function uniqueValues(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function clampPageSize(pageSize?: number) {
  return Math.min(Math.max(Number(pageSize) || 24, 1), 50);
}
