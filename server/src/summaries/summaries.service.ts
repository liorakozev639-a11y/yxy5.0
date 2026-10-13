import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildMemorySummary, getSummaryRange, type SummaryPeriod } from './summary.domain.js';

@Injectable()
export class SummariesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, period: SummaryPeriod, date: string) {
    let range: ReturnType<typeof getSummaryRange>;
    try { range = getSummaryRange(period, date); } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : '日期无效');
    }

    const [memories, copies] = await Promise.all([
      this.prisma.memory.findMany({
        where: { userId, deletedAt: null, eventAt: { gte: range.start, lt: range.end } },
        include: { topics: { include: { topic: true } } },
        orderBy: [{ eventAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.longTermCopy.findMany({
        where: { userId, startDate: { lt: range.end }, lifecycleStatus: { not: 'ARCHIVED' } },
        include: { memoryLinks: { where: { memory: { deletedAt: null, eventAt: { gte: range.start, lt: range.end } } } } },
      }),
    ]);

    return buildMemorySummary(
      period,
      date,
      memories.map((memory) => ({
        id: memory.id,
        mediaId: memory.mediaId,
        title: memory.title,
        note: memory.note,
        mood: memory.mood,
        eventAt: memory.eventAt,
        statuses: memory.statuses,
        topics: memory.topics.map(({ topic }) => ({ id: topic.id, name: topic.name, isNone: topic.isNone })),
      })),
      copies.map((copy) => ({ id: copy.id, name: copy.name, lifecycleStatus: copy.lifecycleStatus, memoryCount: copy.memoryLinks.length })),
    );
  }
}
