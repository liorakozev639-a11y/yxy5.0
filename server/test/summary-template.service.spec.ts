import { describe, expect, it } from 'vitest';
import { buildStoryPlan } from '../src/summaries/summary-story.domain.js';
import type { SummarySnapshot, SummaryStoryMemory } from '../src/summaries/summary-story.types.js';
import { SummaryTemplateService } from '../src/summaries/summary-template.service.js';

function memory(id: string, mood = '开心'): SummaryStoryMemory {
  return {
    id, mediaId: `media-${id}`, imageUrl: `/api/media/media-${id}/file`, storagePath: `D:\\photos\\${id}.jpg`,
    title: '海边散步', note: '风很温柔', mood, eventAt: `2026-02-0${id}T04:00:00.000Z`, statuses: ['散步'], topics: ['恋爱'],
    summaryExcluded: false, deletedAt: null,
  };
}

function snapshot(memories: SummaryStoryMemory[], encouragement?: string): SummarySnapshot {
  return {
    periodType: 'MONTH', periodKey: '2026-02', label: '2026年2月',
    range: { start: '2026-01-31T16:00:00.000Z', end: '2026-02-28T16:00:00.000Z' },
    memories, memoryCount: memories.length, photoCount: memories.length, recordedDays: memories.length,
    topTopics: [{ name: '恋爱', count: memories.length }], topMoods: [], topStatuses: [{ name: '散步', count: memories.length }],
    longTermCopies: [], allowText: true, allowPhotos: true, sourceHash: 'hash', encouragement,
  };
}

describe('SummaryTemplateService', () => {
  it('writes second-person narration around the most frequent recorded mood', () => {
    const data = snapshot([memory('1', '开心'), memory('2', '开心'), memory('3', '平静')]);
    const result = new SummaryTemplateService().generate(data, buildStoryPlan(data).pages);
    const moodPage = result.find((page) => page.pageType === 'MOOD');

    expect(moodPage?.narration).toContain('你');
    expect(moodPage?.narration).toContain('开心');
    expect(result.every((page) => page.narration.includes('你'))).toBe(true);
  });

  it('uses the selected encouragement when no mood exists', () => {
    const copy = '这个月或许没有被定义，但你经历过的每一天都算数。';
    const data = snapshot([memory('1', ''), memory('2', '')], copy);
    const result = new SummaryTemplateService().generate(data, buildStoryPlan(data).pages);

    expect(result.find((page) => page.pageType === 'MOOD')?.narration).toBe(copy);
  });

  it('omits empty copy and ranking chapters instead of inventing content', () => {
    const data = { ...snapshot([memory('1'), memory('2'), memory('3')]), topTopics: [], topStatuses: [], longTermCopies: [] };
    const result = new SummaryTemplateService().generate(data, buildStoryPlan(data).pages);

    expect(result.some((page) => page.pageType === 'COPY')).toBe(false);
    expect(result.map((page) => page.narration).join(' ')).not.toContain('最常');
  });
});
