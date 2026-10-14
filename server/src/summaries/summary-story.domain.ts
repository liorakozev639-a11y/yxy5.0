import { ENCOURAGEMENT_COPY } from './summary-copy.js';
import type {
  LeadMoodResult,
  StoryPeriodType,
  StoryPlan,
  SummaryPageDraft,
  SummaryPageType,
  SummarySnapshot,
  SummaryStoryMemory,
} from './summary-story.types.js';

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function toPeriodKey(periodType: StoryPeriodType, date: Date): string {
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  if (periodType === 'YEAR') return String(year);
  return `${year}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getPreviousPeriod(now: Date, periodType: StoryPeriodType) {
  const shifted = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  const currentYear = shifted.getUTCFullYear();
  if (periodType === 'YEAR') {
    const year = currentYear - 1;
    return { periodType, periodKey: String(year), label: `${year}年` };
  }
  const previous = new Date(Date.UTC(currentYear, shifted.getUTCMonth() - 1, 1));
  const year = previous.getUTCFullYear();
  const month = previous.getUTCMonth() + 1;
  return { periodType, periodKey: `${year}-${String(month).padStart(2, '0')}`, label: `${year}年${month}月` };
}

export function selectLeadMood(memories: SummaryStoryMemory[]): LeadMoodResult | undefined {
  const moods = new Map<string, { count: number; latestAt: string }>();
  memories.forEach((memory) => {
    const name = memory.mood.trim();
    if (!name) return;
    const current = moods.get(name);
    moods.set(name, {
      count: (current?.count ?? 0) + 1,
      latestAt: !current || memory.eventAt > current.latestAt ? memory.eventAt : current.latestAt,
    });
  });
  return [...moods.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((left, right) => right.count - left.count || right.latestAt.localeCompare(left.latestAt) || left.name.localeCompare(right.name, 'zh-CN'))[0];
}

export function selectEncouragement(recent: readonly string[], seed: string): string {
  const blocked = new Set(recent.slice(0, 3));
  const available = ENCOURAGEMENT_COPY.filter((copy) => !blocked.has(copy));
  const pool = available.length ? available : [...ENCOURAGEMENT_COPY];
  return pool[stableHash(seed) % pool.length];
}

export function selectRepresentativeMemories(memories: SummaryStoryMemory[], limit: number): SummaryStoryMemory[] {
  const ranked = memories
    .filter((memory) => !memory.summaryExcluded && !memory.deletedAt)
    .sort((left, right) => representativeScore(right) - representativeScore(left)
      || right.eventAt.localeCompare(left.eventAt)
      || left.id.localeCompare(right.id));
  const selected: SummaryStoryMemory[] = [];
  const days = new Set<string>();
  ranked.forEach((memory) => {
    if (selected.length >= limit) return;
    const day = shanghaiDay(memory.eventAt);
    if (!days.has(day)) {
      selected.push(memory);
      days.add(day);
    }
  });
  ranked.forEach((memory) => {
    if (selected.length < limit && !selected.some((item) => item.id === memory.id)) selected.push(memory);
  });
  return selected;
}

export function buildStoryPlan(snapshot: SummarySnapshot): StoryPlan {
  if (snapshot.memoryCount === 0) return { shouldGenerate: false, isCompact: false, pages: [] };
  const representatives = selectRepresentativeMemories(snapshot.memories, snapshot.periodType === 'YEAR' ? 6 : 3);
  const leadMood = selectLeadMood(snapshot.memories);
  const isCompact = snapshot.memoryCount <= 2;
  if (isCompact) {
    return {
      shouldGenerate: true,
      isCompact: true,
      pages: orderPages([
        page('COVER', 'compact-cover', [], { label: snapshot.label }),
        page('MOOD', leadMood ? 'lead-mood' : 'encouragement', leadMood ? [`mood:${leadMood.name}`] : [], { leadMood }),
        page('MEMORY', 'compact-memory', representatives.map((memory) => `memory:${memory.id}`), { memoryIds: representatives.map((memory) => memory.id) }),
        page('REFLECTION', 'future-reflection', [], { periodType: snapshot.periodType }),
      ]),
    };
  }
  const pages = snapshot.periodType === 'MONTH' ? monthlyPages(snapshot, representatives, leadMood) : yearlyPages(snapshot, representatives, leadMood);
  return { shouldGenerate: true, isCompact: false, pages: orderPages(pages) };
}

function monthlyPages(snapshot: SummarySnapshot, representatives: SummaryStoryMemory[], leadMood?: LeadMoodResult): SummaryPageDraft[] {
  return [
    page('COVER', 'monthly-cover', [], { label: snapshot.label }),
    page('OVERVIEW', 'monthly-overview', ['memoryCount', 'recordedDays'], { memoryCount: snapshot.memoryCount, photoCount: snapshot.photoCount, recordedDays: snapshot.recordedDays }),
    page('MOOD', leadMood ? 'lead-mood' : 'encouragement', leadMood ? [`mood:${leadMood.name}`] : [], { leadMood }),
    page('MEMORY', 'monthly-memories', representatives.map((memory) => `memory:${memory.id}`), { memoryIds: representatives.map((memory) => memory.id) }),
    page('COPY', 'monthly-copy', snapshot.longTermCopies.map((copy) => `copy:${copy.id}`), { copies: snapshot.longTermCopies }),
    page('CLOSING', 'monthly-closing', [], { topTopics: snapshot.topTopics }),
    page('REFLECTION', 'future-reflection', [], { periodType: snapshot.periodType }),
  ];
}

function yearlyPages(snapshot: SummarySnapshot, representatives: SummaryStoryMemory[], leadMood?: LeadMoodResult): SummaryPageDraft[] {
  return [
    page('COVER', 'yearly-cover', [], { label: snapshot.label }),
    page('OVERVIEW', 'yearly-overview', ['memoryCount', 'recordedDays'], { memoryCount: snapshot.memoryCount, photoCount: snapshot.photoCount, recordedDays: snapshot.recordedDays }),
    page('SEASON', 'spring', [], { season: '春' }),
    page('SEASON', 'summer', [], { season: '夏' }),
    page('SEASON', 'autumn-winter', [], { season: '秋冬' }),
    page('COPY', 'yearly-copy', snapshot.longTermCopies.map((copy) => `copy:${copy.id}`), { copies: snapshot.longTermCopies }),
    page('MOOD', leadMood ? 'lead-mood' : 'encouragement', leadMood ? [`mood:${leadMood.name}`] : [], { leadMood }),
    page('MEMORY', 'yearly-memories', representatives.map((memory) => `memory:${memory.id}`), { memoryIds: representatives.map((memory) => memory.id) }),
    page('QUOTE', 'original-quote', representatives.map((memory) => `memory:${memory.id}`), { memoryIds: representatives.map((memory) => memory.id) }),
    page('ORDINARY', 'ordinary-days', [], { topStatuses: snapshot.topStatuses }),
    page('CLOSING', 'yearly-closing', [], { topTopics: snapshot.topTopics }),
    page('REFLECTION', 'future-reflection', [], { periodType: snapshot.periodType }),
  ];
}

function page(pageType: SummaryPageType, templateKey: string, factRefs: string[], payload: Record<string, unknown>): SummaryPageDraft {
  return { pageType, displayOrder: 0, templateKey, narration: '', factRefs, payload };
}

function orderPages(pages: SummaryPageDraft[]): SummaryPageDraft[] {
  return pages.map((item, displayOrder) => ({ ...item, displayOrder }));
}

function representativeScore(memory: SummaryStoryMemory): number {
  return (memory.title.trim() ? 2 : 0)
    + (memory.note.trim() ? 3 : 0)
    + (memory.mood.trim() ? 1 : 0)
    + memory.statuses.filter(Boolean).length
    + memory.topics.filter(Boolean).length;
}

function shanghaiDay(value: string): string {
  return new Date(new Date(value).getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
