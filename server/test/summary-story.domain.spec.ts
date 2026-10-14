import { describe, expect, it } from 'vitest';
import {
  buildStoryPlan,
  getPreviousPeriod,
  selectEncouragement,
  selectLeadMood,
  selectRepresentativeMemories,
  toPeriodKey,
} from '../src/summaries/summary-story.domain.js';
import { ENCOURAGEMENT_COPY } from '../src/summaries/summary-copy.js';
import type { SummarySnapshot, SummaryStoryMemory } from '../src/summaries/summary-story.types.js';

function memory(input: Partial<SummaryStoryMemory> & Pick<SummaryStoryMemory, 'id' | 'eventAt'>): SummaryStoryMemory {
  return {
    mediaId: `media-${input.id}`,
    imageUrl: `/api/media/media-${input.id}/file`,
    title: '',
    note: '',
    mood: '',
    statuses: [],
    topics: [],
    summaryExcluded: false,
    deletedAt: null,
    ...input,
  };
}

function snapshot(memories: SummaryStoryMemory[], periodType: 'MONTH' | 'YEAR' = 'MONTH'): SummarySnapshot {
  return {
    periodType,
    periodKey: periodType === 'MONTH' ? '2026-02' : '2025',
    label: periodType === 'MONTH' ? '2026年2月' : '2025年',
    range: { start: '2026-01-31T16:00:00.000Z', end: '2026-02-28T16:00:00.000Z' },
    memories,
    memoryCount: memories.length,
    photoCount: memories.filter((item) => item.mediaId).length,
    recordedDays: new Set(memories.map((item) => item.eventAt.slice(0, 10))).size,
    topTopics: [],
    topMoods: [],
    topStatuses: [],
    longTermCopies: [],
    allowText: true,
    allowPhotos: true,
  };
}

describe('summary story periods', () => {
  it('finds the previous Shanghai calendar month at a UTC month boundary', () => {
    expect(getPreviousPeriod(new Date('2026-02-28T16:30:00.000Z'), 'MONTH')).toEqual({
      periodType: 'MONTH',
      periodKey: '2026-02',
      label: '2026年2月',
    });
  });

  it('finds the previous year on January first in Shanghai', () => {
    expect(getPreviousPeriod(new Date('2025-12-31T16:01:00.000Z'), 'YEAR')).toEqual({
      periodType: 'YEAR',
      periodKey: '2025',
      label: '2025年',
    });
  });

  it('converts instants to Shanghai period keys across midnight and leap day', () => {
    expect(toPeriodKey('MONTH', new Date('2024-02-29T15:59:59.999Z'))).toBe('2024-02');
    expect(toPeriodKey('MONTH', new Date('2024-02-29T16:00:00.000Z'))).toBe('2024-03');
    expect(toPeriodKey('YEAR', new Date('2025-12-31T16:00:00.000Z'))).toBe('2026');
  });
});

describe('summary story emotion rules', () => {
  it('chooses the most frequent mood and uses the latest occurrence to break a tie', () => {
    const memories = [
      memory({ id: 'a', eventAt: '2026-02-01T04:00:00.000Z', mood: '开心' }),
      memory({ id: 'b', eventAt: '2026-02-02T04:00:00.000Z', mood: '平静' }),
      memory({ id: 'c', eventAt: '2026-02-03T04:00:00.000Z', mood: '开心' }),
      memory({ id: 'd', eventAt: '2026-02-04T04:00:00.000Z', mood: '平静' }),
    ];

    expect(selectLeadMood(memories)).toEqual({ name: '平静', count: 2, latestAt: '2026-02-04T04:00:00.000Z' });
  });

  it('returns no lead mood when the user did not record one', () => {
    expect(selectLeadMood([memory({ id: 'a', eventAt: '2026-02-01T04:00:00.000Z' })])).toBeUndefined();
  });

  it('selects stable encouragement copy without repeating the latest three choices', () => {
    const recent = ENCOURAGEMENT_COPY.slice(0, 3);
    const first = selectEncouragement(recent, 'local-user:2026-02');
    const second = selectEncouragement(recent, 'local-user:2026-02');

    expect(first).toBe(second);
    expect(recent).not.toContain(first);
    expect(ENCOURAGEMENT_COPY.length).toBeGreaterThanOrEqual(12);
  });
});

describe('summary story selection and plan', () => {
  it('selects complete memories across dates and excludes deleted or opted-out memories', () => {
    const selected = selectRepresentativeMemories([
      memory({ id: 'rich-day-one', eventAt: '2026-02-01T04:00:00.000Z', title: '海边', note: '风很温柔', mood: '开心', statuses: ['散步'], topics: ['旅行'] }),
      memory({ id: 'same-day', eventAt: '2026-02-01T06:00:00.000Z', title: '午后', note: '阳光很好' }),
      memory({ id: 'other-day', eventAt: '2026-02-03T04:00:00.000Z', title: '图书馆', note: '继续复习', mood: '平静' }),
      memory({ id: 'excluded', eventAt: '2026-02-04T04:00:00.000Z', title: '不展示', note: '不展示', summaryExcluded: true }),
      memory({ id: 'deleted', eventAt: '2026-02-05T04:00:00.000Z', title: '已删除', note: '已删除', deletedAt: '2026-02-06T04:00:00.000Z' }),
    ], 2);

    expect(selected.map((item) => item.id)).toEqual(['rich-day-one', 'other-day']);
  });

  it('does not generate a story for an empty period', () => {
    expect(buildStoryPlan(snapshot([]))).toEqual({ shouldGenerate: false, isCompact: false, pages: [] });
  });

  it('builds a four-page compact story for one or two memories', () => {
    const result = buildStoryPlan(snapshot([memory({ id: 'only', eventAt: '2026-02-01T04:00:00.000Z' })]));

    expect(result.shouldGenerate).toBe(true);
    expect(result.isCompact).toBe(true);
    expect(result.pages).toHaveLength(4);
    expect(result.pages.map((page) => page.pageType)).toEqual(['COVER', 'MOOD', 'MEMORY', 'REFLECTION']);
  });

  it('builds a mixed monthly story and a twelve-page yearly story', () => {
    const memories = Array.from({ length: 8 }, (_, index) => memory({
      id: `m-${index}`,
      eventAt: `2026-02-${String(index + 1).padStart(2, '0')}T04:00:00.000Z`,
      mood: index < 3 ? '开心' : '平静',
      title: `记忆 ${index + 1}`,
      note: '真实记录',
    }));
    const monthly = buildStoryPlan({ ...snapshot(memories), longTermCopies: [{ id: 'copy-1', name: '考研', memoryCount: 6, lifecycleStatus: 'ACTIVE' }] });
    const yearly = buildStoryPlan(snapshot(memories, 'YEAR'));

    expect(monthly.pages).toHaveLength(7);
    expect(monthly.pages.map((page) => page.pageType)).toEqual(['COVER', 'OVERVIEW', 'MOOD', 'MEMORY', 'COPY', 'CLOSING', 'REFLECTION']);
    expect(yearly.pages).toHaveLength(12);
    expect(yearly.pages[0].pageType).toBe('COVER');
    expect(yearly.pages.at(-1)?.pageType).toBe('REFLECTION');
  });
});
