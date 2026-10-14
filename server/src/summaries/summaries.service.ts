import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildMemorySummary, getSummaryRange, type SummaryPeriod } from './summary.domain.js';
import type { SummaryPreferenceInput } from './summary.dto.js';

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

  async getPreferences(userId: string) {
    const preference = await this.prisma.summaryPreference.findUnique({ where: { userId } });
    if (!preference) {
      return {
        userId,
        enabled: true,
        allowText: true,
        allowPhotos: true,
        allowCloudAi: false,
        reviewed: false,
        consentReviewedAt: null,
      };
    }
    return this.preferenceView(preference);
  }

  async updatePreferences(userId: string, input: SummaryPreferenceInput) {
    if (input.reviewed !== true) throw new BadRequestException('请先确认总结与云端 AI 授权');
    const consentReviewedAt = new Date();
    const preference = await this.prisma.summaryPreference.upsert({
      where: { userId },
      create: {
        userId,
        enabled: input.enabled ?? true,
        allowText: input.allowText ?? true,
        allowPhotos: input.allowPhotos ?? true,
        allowCloudAi: input.allowCloudAi ?? false,
        consentReviewedAt,
      },
      update: {
        ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        ...(input.allowText === undefined ? {} : { allowText: input.allowText }),
        ...(input.allowPhotos === undefined ? {} : { allowPhotos: input.allowPhotos }),
        ...(input.allowCloudAi === undefined ? {} : { allowCloudAi: input.allowCloudAi }),
        consentReviewedAt,
      },
    });
    return this.preferenceView(preference);
  }

  private preferenceView(preference: {
    userId: string;
    enabled: boolean;
    allowText: boolean;
    allowPhotos: boolean;
    allowCloudAi: boolean;
    consentReviewedAt: Date | null;
  }) {
    return { ...preference, reviewed: Boolean(preference.consentReviewedAt) };
  }
}
