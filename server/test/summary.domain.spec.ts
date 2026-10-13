import { describe, expect, it } from 'vitest';
import { buildMemorySummary, getSummaryRange, type SummaryMemoryInput } from '../src/summaries/summary.domain.js';

function memory(input: Partial<SummaryMemoryInput> & Pick<SummaryMemoryInput, 'id' | 'eventAt'>): SummaryMemoryInput {
  return {
    title: '', note: '', mood: '', statuses: [], topics: [], mediaId: `media-${input.id}`,
    ...input,
  };
}

describe('memory summary domain', () => {
  it('returns a truthful empty monthly summary', () => {
    const result = buildMemorySummary('month', '2026-02-10', []);

    expect(result.label).toBe('2026年2月');
    expect(result.memoryCount).toBe(0);
    expect(result.recordedDays).toBe(0);
    expect(result.topTopics).toEqual([]);
    expect(result.representativeMemories).toEqual([]);
  });

  it('uses Asia/Shanghai month boundaries without leaking adjacent records', () => {
    const result = buildMemorySummary('month', '2026-02-10', [
      memory({ id: 'before', eventAt: new Date('2026-01-31T15:59:59.999Z') }),
      memory({ id: 'first', eventAt: new Date('2026-01-31T16:00:00.000Z') }),
      memory({ id: 'last', eventAt: new Date('2026-02-28T15:59:59.999Z') }),
      memory({ id: 'after', eventAt: new Date('2026-02-28T16:00:00.000Z') }),
    ]);

    expect(result.representativeMemories.map((item) => item.id).sort()).toEqual(['first', 'last']);
    expect(result.memoryCount).toBe(2);
    expect(result.recordedDays).toBe(2);
  });

  it('uses full calendar-year boundaries', () => {
    const range = getSummaryRange('year', '2026-08-01');
    expect(range.start.toISOString()).toBe('2025-12-31T16:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-12-31T16:00:00.000Z');
  });

  it('ranks tied categories deterministically and ignores the “无” topic', () => {
    const result = buildMemorySummary('year', '2026-08-01', [
      memory({ id: 'a', eventAt: new Date('2026-02-01T04:00:00Z'), mood: '开心', statuses: ['散步'], topics: [{ id: 'none', name: '无', isNone: true }, { id: 'b', name: '读研', isNone: false }] }),
      memory({ id: 'b', eventAt: new Date('2026-03-01T04:00:00Z'), mood: '平静', statuses: ['约会'], topics: [{ id: 'a', name: '恋爱', isNone: false }] }),
    ]);

    expect(result.topTopics).toEqual([{ name: '恋爱', count: 1 }, { name: '读研', count: 1 }]);
    expect(result.topMoods).toEqual([{ name: '平静', count: 1 }, { name: '开心', count: 1 }]);
    expect(result.topStatuses).toEqual([{ name: '散步', count: 1 }, { name: '约会', count: 1 }]);
  });

  it('selects representative memories by completeness, then date and id', () => {
    const result = buildMemorySummary('year', '2026-08-01', [
      memory({ id: 'plain', eventAt: new Date('2026-06-01T04:00:00Z'), title: '只有标题' }),
      memory({ id: 'rich-old', eventAt: new Date('2026-05-01T04:00:00Z'), title: '完整记忆', note: '很多细节', mood: '开心', statuses: ['散步'], topics: [{ id: 'love', name: '恋爱', isNone: false }] }),
      memory({ id: 'rich-new', eventAt: new Date('2026-07-01T04:00:00Z'), title: '完整记忆', note: '很多细节', mood: '开心', statuses: ['散步'], topics: [{ id: 'love', name: '恋爱', isNone: false }] }),
    ]);

    expect(result.representativeMemories.map((item) => item.id)).toEqual(['rich-new', 'rich-old', 'plain']);
    expect(result.representativeMemories[0].imageUrl).toBe('/api/media/media-rich-new/file');
  });
});
