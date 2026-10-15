import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MemorySearchInput, MemorySearchItem, MemorySearchPage } from './memory-search.types.js';

@Injectable()
export class MemorySearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, input: MemorySearchInput): Promise<MemorySearchPage> {
    const where = this.buildWhere(userId, input);
    const ascending = input.sort === 'OLDEST';
    const pageSize = 5;
    const [rows, total] = await Promise.all([
      this.prisma.memory.findMany({
        where,
        include: {
          media: true,
          topics: { include: { topic: true } },
          copyLinks: { include: { copy: true } },
        },
        orderBy: [{ eventAt: ascending ? 'asc' : 'desc' }, { id: ascending ? 'asc' : 'desc' }],
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        take: pageSize + 1,
      }),
      this.prisma.memory.count({ where }),
    ]);

    const hasNext = rows.length > pageSize;
    const items = rows.slice(0, pageSize).map((row) => this.toItem(row));
    return {
      items,
      total,
      ...(hasNext ? { nextCursor: items.at(-1)?.id } : {}),
    };
  }

  private buildWhere(userId: string, input: MemorySearchInput) {
    const where: Record<string, unknown> = { userId, deletedAt: null };
    if (input.from || input.to) {
      where.eventAt = {
        ...(input.from ? { gte: new Date(input.from) } : {}),
        ...(input.to ? { lt: new Date(input.to) } : {}),
      };
    }
    if (input.mood?.trim()) where.mood = input.mood.trim();
    const statuses = uniqueValues(input.statusValues);
    if (statuses.length) where.statuses = { hasEvery: statuses };

    const and: Array<Record<string, unknown>> = [];
    for (const topicId of uniqueValues(input.topicIds)) {
      and.push({ topics: { some: { topicId } } });
    }
    for (const keyword of uniqueValues(input.keywords)) {
      and.push({
        OR: [
          { title: { contains: keyword, mode: 'insensitive' } },
          { note: { contains: keyword, mode: 'insensitive' } },
        ],
      });
    }
    if (and.length) where.AND = and;
    return where;
  }

  private toItem(memory: any): MemorySearchItem {
    const topics = (memory.topics ?? []).map((item: any) => ({
      id: item.topic?.id ?? item.topicId,
      name: item.topic?.name ?? '',
    }));
    const longTermCopies = (memory.copyLinks ?? []).map((item: any) => ({
      id: item.copy?.id ?? item.copyId,
      name: item.copy?.name ?? '',
    }));
    return {
      id: memory.id,
      userId: memory.userId,
      mediaId: memory.mediaId,
      imageUrl: memory.media ? `/api/media/${memory.media.id}/file` : '',
      title: memory.title ?? '',
      note: memory.note ?? '',
      mood: memory.mood ?? '',
      eventAt: memory.eventAt,
      timezone: memory.timezone,
      statuses: memory.statuses ?? [],
      topicIds: topics.map((topic: { id: string }) => topic.id),
      topics,
      longTermCopies,
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
