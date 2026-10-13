export type SummaryPeriod = 'month' | 'year';

export interface SummaryMemoryInput {
  id: string;
  mediaId: string;
  title: string;
  note: string;
  mood: string;
  eventAt: Date;
  statuses: string[];
  topics: Array<{ id: string; name: string; isNone: boolean }>;
}

export interface SummaryCopyInput {
  id: string;
  name: string;
  lifecycleStatus: string;
  memoryCount: number;
}

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function getSummaryRange(period: SummaryPeriod, date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error('日期必须使用 YYYY-MM-DD 格式');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error('日期无效');
  }

  const start = new Date(Date.UTC(year, period === 'month' ? month - 1 : 0, 1) - SHANGHAI_OFFSET_MS);
  const end = new Date(Date.UTC(period === 'year' ? year + 1 : year, period === 'month' ? month : 0, 1) - SHANGHAI_OFFSET_MS);
  return { start, end };
}

export function buildMemorySummary(
  period: SummaryPeriod,
  date: string,
  memories: SummaryMemoryInput[],
  longTermCopies: SummaryCopyInput[] = [],
) {
  const range = getSummaryRange(period, date);
  const selected = memories.filter((memory) => memory.eventAt >= range.start && memory.eventAt < range.end);
  const [year, month] = date.split('-').map(Number);
  const label = period === 'month' ? `${year}年${month}月` : `${year}年`;

  return {
    period,
    date,
    label,
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    memoryCount: selected.length,
    photoCount: selected.length,
    recordedDays: new Set(selected.map((memory) => shanghaiDay(memory.eventAt))).size,
    topTopics: rank(selected.flatMap((memory) => memory.topics.filter((topic) => !topic.isNone).map((topic) => topic.name))),
    topMoods: rank(selected.map((memory) => memory.mood)),
    topStatuses: rank(selected.flatMap((memory) => memory.statuses)),
    representativeMemories: [...selected]
      .sort((left, right) => representativeScore(right) - representativeScore(left)
        || right.eventAt.getTime() - left.eventAt.getTime()
        || compareText(left.id, right.id))
      .slice(0, 3)
      .map((memory) => ({
        id: memory.id,
        mediaId: memory.mediaId,
        imageUrl: `/api/media/${memory.mediaId}/file`,
        title: memory.title,
        note: memory.note,
        mood: memory.mood,
        eventAt: memory.eventAt.toISOString(),
      })),
    longTermCopies: [...longTermCopies].sort((left, right) => right.memoryCount - left.memoryCount || compareText(left.name, right.name)),
  };
}

function representativeScore(memory: SummaryMemoryInput): number {
  return (memory.title.trim() ? 2 : 0)
    + (memory.note.trim() ? 3 : 0)
    + (memory.mood.trim() ? 1 : 0)
    + memory.statuses.filter(Boolean).length
    + memory.topics.filter((topic) => !topic.isNone).length;
}

function rank(values: string[]) {
  const counts = new Map<string, number>();
  values.map((value) => value.trim()).filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || compareText(left.name, right.name))
    .slice(0, 5);
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function shanghaiDay(date: Date): string {
  return new Date(date.getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}
