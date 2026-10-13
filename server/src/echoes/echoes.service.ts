import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { rankEchoCandidates, toShanghaiDateKey, type EchoCandidate, type EchoCopyContext } from './echo-ranking.js';

type PreferenceInput = { enabled?: boolean; excludedMoods?: string[] };

const echoInclude = {
  memory: { include: { media: true, topics: { include: { topic: true } } } },
  comparisonMemory: { include: { media: true, topics: { include: { topic: true } } } },
  sourceTopic: true,
  reflection: true,
};

@Injectable()
export class EchoesService {
  constructor(private readonly prisma: PrismaService) {}

  async today(userId: string, now = new Date()) {
    const preference = await this.prisma.echoPreference.findUnique({ where: { userId } });
    if (preference?.enabled === false) return [];

    const echoDate = dateFromKey(toShanghaiDateKey(now));
    const existing = await this.findForDate(userId, echoDate);
    if (existing.length) return existing.map((row: any) => this.toView(row));
    const generated = await this.prisma.echoGeneration.findUnique({ where: { userId_echoDate: { userId, echoDate } } });
    if (generated) return [];

    const recentStart = new Date(echoDate);
    recentStart.setUTCDate(recentStart.getUTCDate() - 30);
    const [memories, copies, disabledTopics, recentEchoes] = await Promise.all([
      this.prisma.memory.findMany({
        where: { userId, deletedAt: null, echoExcluded: false },
        include: { media: true, topics: { include: { topic: true } } },
      }),
      this.prisma.longTermCopy.findMany({
        where: { userId },
        include: { memoryLinks: { include: { memory: true } } },
      }),
      this.prisma.topic.findMany({ where: { userId, echoEnabled: false }, select: { id: true } }),
      this.prisma.memoryEcho.findMany({
        where: { userId, echoDate: { gte: recentStart, lt: echoDate } },
        select: { memoryId: true },
      }),
    ]);

    const copyContexts = buildCopyContexts(copies as any[]);
    const candidates: EchoCandidate[] = (memories as any[]).map((memory) => ({
      memoryId: memory.id,
      eventAt: memory.eventAt,
      mood: memory.mood ?? '',
      topicIds: (memory.topics ?? []).map((item: any) => item.topic?.id ?? item.topicId),
      echoExcluded: memory.echoExcluded,
      copies: copyContexts.filter((copy) => copy.memoryIds.has(memory.id)).map(({ memoryIds: _memoryIds, ...copy }) => copy),
    }));
    const ranked = rankEchoCandidates({
      candidates,
      today: now,
      recentlyShownMemoryIds: (recentEchoes as any[]).map((item) => item.memoryId),
      excludedMoods: preference?.excludedMoods ?? [],
      disabledTopicIds: (disabledTopics as any[]).map((item) => item.id),
    });
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await tx.echoGeneration.create({ data: { userId, echoDate } });
        const rows = [];
        for (const [index, item] of ranked.entries()) {
          rows.push(await tx.memoryEcho.create({
            data: {
              userId,
              memoryId: item.memoryId,
              comparisonMemoryId: item.comparisonMemoryId,
              longTermCopyId: item.longTermCopyId,
              sourceTopicId: item.topicId,
              echoDate,
              echoType: item.type,
              reason: item.reason,
              score: item.score,
              displayOrder: index + 1,
            },
            include: echoInclude,
          }));
        }
        return rows;
      });
      return created.map((row: any) => this.toView(row));
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      return (await this.findForDate(userId, echoDate)).map((row: any) => this.toView(row));
    }
  }

  async list(userId: string, days = 30, now = new Date()) {
    const today = dateFromKey(toShanghaiDateKey(now));
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    const rows = await this.prisma.memoryEcho.findMany({
      where: { userId, echoDate: { gte: from, lte: today } },
      include: echoInclude,
      orderBy: [{ echoDate: 'desc' }, { displayOrder: 'asc' }],
    });
    return rows.map((row: any) => this.toView(row));
  }

  async upsertReflection(userId: string, echoId: string, text: string) {
    const echo = await this.prisma.memoryEcho.findFirst({ where: { id: echoId, userId } });
    if (!echo) throw new NotFoundException('记忆回声不存在');
    const value = text.trim();
    return this.prisma.echoReflection.upsert({
      where: { memoryEchoId: echoId },
      create: { userId, memoryId: echo.memoryId, memoryEchoId: echoId, sourceEchoDate: echo.echoDate, text: value },
      update: { text: value },
    });
  }

  async listReflections(userId: string, memoryId: string) {
    const memory = await this.prisma.memory.findFirst({ where: { id: memoryId, userId, deletedAt: null } });
    if (!memory) throw new NotFoundException('记忆不存在');
    return this.prisma.echoReflection.findMany({ where: { userId, memoryId }, orderBy: { sourceEchoDate: 'desc' } });
  }

  async dismiss(userId: string, echoId: string) {
    const result = await this.prisma.memoryEcho.updateMany({ where: { id: echoId, userId }, data: { status: 'DISMISSED' } });
    if (!result.count) throw new NotFoundException('记忆回声不存在');
    return { ok: true };
  }

  async getPreferences(userId: string) {
    return (await this.prisma.echoPreference.findUnique({ where: { userId } })) ?? { userId, enabled: true, excludedMoods: [] };
  }

  updatePreferences(userId: string, input: PreferenceInput) {
    const excludedMoods = input.excludedMoods === undefined ? undefined : uniqueValues(input.excludedMoods);
    return this.prisma.echoPreference.upsert({
      where: { userId },
      create: { userId, enabled: input.enabled ?? true, excludedMoods: excludedMoods ?? [] },
      update: { ...(input.enabled === undefined ? {} : { enabled: input.enabled }), ...(excludedMoods === undefined ? {} : { excludedMoods }) },
    });
  }

  private findForDate(userId: string, echoDate: Date) {
    return this.prisma.memoryEcho.findMany({
      where: { userId, echoDate },
      include: echoInclude,
      orderBy: { displayOrder: 'asc' },
    });
  }

  private toView(row: any) {
    const memoryAvailable = Boolean(row.memory && !row.memory.deletedAt);
    const comparisonMemoryAvailable = Boolean(row.comparisonMemory && !row.comparisonMemory.deletedAt);
    return {
      id: row.id,
      echoDate: dateKey(row.echoDate),
      type: row.echoType,
      reason: row.reason,
      score: row.score,
      displayOrder: row.displayOrder,
      status: row.status,
      viewedAt: row.viewedAt,
      createdAt: row.createdAt,
      longTermCopyId: row.longTermCopyId ?? undefined,
      sourceTopic: row.sourceTopic ? { id: row.sourceTopic.id, name: row.sourceTopic.name } : undefined,
      memoryAvailable,
      ...(memoryAvailable ? { memory: memoryView(row.memory) } : {}),
      comparisonMemoryAvailable,
      ...(comparisonMemoryAvailable ? { comparisonMemory: memoryView(row.comparisonMemory) } : {}),
      reflection: row.reflection ?? undefined,
    };
  }
}

function buildCopyContexts(copies: any[]) {
  return copies.map((copy) => {
    const links = (copy.memoryLinks ?? [])
      .filter((link: any) => !link.memory?.deletedAt)
      .sort((left: any, right: any) => left.memory.eventAt.getTime() - right.memory.eventAt.getTime());
    return {
      copyId: copy.id,
      copyName: copy.name,
      topicId: copy.topicId,
      startDate: copy.startDate,
      firstMemoryId: links[0]?.memoryId,
      latestMemoryId: links.at(-1)?.memoryId,
      memoryIds: new Set<string>(links.map((link: any) => link.memoryId)),
    } satisfies EchoCopyContext & { memoryIds: Set<string> };
  });
}

function memoryView(memory: any) {
  const topics = (memory.topics ?? []).map((item: any) => ({ id: item.topic?.id ?? item.topicId, name: item.topic?.name ?? '' }));
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
    echoExcluded: memory.echoExcluded ?? false,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}

function dateFromKey(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

function dateKey(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
