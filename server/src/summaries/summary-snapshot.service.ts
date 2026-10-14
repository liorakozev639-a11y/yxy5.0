import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getSummaryRange } from './summary.domain.js';
import { selectEncouragement, selectLeadMood } from './summary-story.domain.js';
import type { StoryPeriodType, SummaryRank, SummarySnapshot, SummaryStoryMemory } from './summary-story.types.js';

type SnapshotPreference = { allowText: boolean; allowPhotos: boolean };
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class SummarySnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, periodType: StoryPeriodType, periodKey: string, preference: SnapshotPreference): Promise<SummarySnapshot | null> {
    const date = periodType === 'MONTH' ? `${periodKey}-01` : `${periodKey}-01-01`;
    const range = getSummaryRange(periodType === 'MONTH' ? 'month' : 'year', date);
    const [rows, copies, recentSummaries] = await Promise.all([
      this.prisma.memory.findMany({
        where: { userId, deletedAt: null, summaryExcluded: false, eventAt: { gte: range.start, lt: range.end } },
        include: { media: true, topics: { include: { topic: true } } },
        orderBy: [{ eventAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.longTermCopy.findMany({
        where: { userId, startDate: { lt: range.end }, lifecycleStatus: { not: 'ARCHIVED' } },
        include: { memoryLinks: { where: { memory: { deletedAt: null, summaryExcluded: false, eventAt: { gte: range.start, lt: range.end } } } } },
      }),
      this.prisma.memorySummary.findMany({
        where: { userId, periodType: 'MONTH', periodKey: { lt: periodKey }, status: 'READY' },
        select: { sourceSnapshot: true },
        orderBy: { periodKey: 'desc' },
        take: 3,
      }),
    ]);
    if (!rows.length) return null;

    const memories: SummaryStoryMemory[] = rows.map((row: any) => ({
      id: row.id,
      ...(preference.allowPhotos ? {
        mediaId: row.mediaId,
        imageUrl: `/api/media/${row.mediaId}/file`,
        storagePath: row.media?.storagePath,
      } : {}),
      title: preference.allowText ? row.title ?? '' : '',
      note: preference.allowText ? row.note ?? '' : '',
      mood: row.mood ?? '',
      eventAt: new Date(row.eventAt).toISOString(),
      statuses: row.statuses ?? [],
      topics: (row.topics ?? []).map((item: any) => item.topic).filter((topic: any) => topic && !topic.isNone).map((topic: any) => topic.name),
      summaryExcluded: row.summaryExcluded ?? false,
      deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
    }));
    const label = periodType === 'MONTH'
      ? `${Number(periodKey.slice(0, 4))}年${Number(periodKey.slice(5, 7))}月`
      : `${Number(periodKey)}年`;
    const previousCopy = recentSummaries
      .map((summary: any) => (summary.sourceSnapshot as { encouragement?: unknown } | null)?.encouragement)
      .filter((value: unknown): value is string => typeof value === 'string');
    const leadMood = selectLeadMood(memories);
    const base = {
      periodType,
      periodKey,
      label,
      range: { start: range.start.toISOString(), end: range.end.toISOString() },
      memories,
      memoryCount: memories.length,
      photoCount: preference.allowPhotos ? memories.filter((memory) => memory.mediaId).length : 0,
      recordedDays: new Set(memories.map((memory) => shanghaiDay(memory.eventAt))).size,
      topTopics: rank(memories.flatMap((memory) => memory.topics)),
      topMoods: rank(memories.map((memory) => memory.mood)),
      topStatuses: rank(memories.flatMap((memory) => memory.statuses)),
      longTermCopies: copies.map((copy: any) => ({
        id: copy.id,
        name: copy.name,
        lifecycleStatus: copy.lifecycleStatus,
        memoryCount: copy.memoryLinks?.length ?? 0,
      })).filter((copy: { memoryCount: number }) => copy.memoryCount > 0),
      allowText: preference.allowText,
      allowPhotos: preference.allowPhotos,
      encouragement: leadMood ? undefined : selectEncouragement(previousCopy, `${userId}:${periodKey}`),
    };
    return { ...base, sourceHash: hashSnapshot(base) };
  }
}

function rank(values: string[]): SummaryRank[] {
  const counts = new Map<string, number>();
  values.map((value) => value.trim()).filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh-CN'))
    .slice(0, 5);
}

function hashSnapshot(snapshot: object): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

function shanghaiDay(value: string): string {
  return new Date(new Date(value).getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}
