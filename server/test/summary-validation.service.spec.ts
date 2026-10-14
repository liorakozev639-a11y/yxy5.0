import { describe, expect, it } from 'vitest';
import { SummaryValidationService } from '../src/summaries/summary-validation.service.js';
import type { SummaryAiSuccess, SummaryPageDraft, SummarySnapshot } from '../src/summaries/summary-story.types.js';

const snapshot: SummarySnapshot = {
  periodType: 'MONTH', periodKey: '2026-02', label: '2026年2月',
  range: { start: '2026-01-31T16:00:00.000Z', end: '2026-02-28T16:00:00.000Z' },
  memories: [{ id: 'memory-1', title: '海边', note: '风很温柔', mood: '开心', eventAt: '2026-02-02T04:00:00.000Z', statuses: ['散步'], topics: ['恋爱'], summaryExcluded: false, deletedAt: null }],
  memoryCount: 1, photoCount: 0, recordedDays: 1,
  topTopics: [{ name: '恋爱', count: 1 }], topMoods: [{ name: '开心', count: 1 }], topStatuses: [{ name: '散步', count: 1 }],
  longTermCopies: [], allowText: true, allowPhotos: false, sourceHash: 'hash',
};
const plan: SummaryPageDraft[] = [
  { pageType: 'MOOD', displayOrder: 0, templateKey: 'lead-mood', narration: '', factRefs: ['mood:开心', 'memory:memory-1'], payload: {} },
];

function result(narration: string, factRefs = plan[0].factRefs): SummaryAiSuccess {
  return { ok: true, pages: [{ pageType: 'MOOD', displayOrder: 0, narration, factRefs }] };
}

describe('SummaryValidationService', () => {
  it('accepts narration that keeps the planned page identity and known facts', () => {
    const validated = new SummaryValidationService().validate(result('这个月，你在1段记忆里留下了开心。'), snapshot, plan);
    expect(validated).toEqual(expect.objectContaining({ ok: true }));
  });

  it('rejects unknown memory, mood, and topic references', () => {
    const service = new SummaryValidationService();
    expect(service.validate(result('你记录了开心。', ['memory:missing']), snapshot, plan)).toEqual({ ok: false, reason: 'UNKNOWN_FACT' });
    expect(service.validate(result('你记录了兴奋。', ['mood:兴奋']), snapshot, plan)).toEqual({ ok: false, reason: 'UNKNOWN_FACT' });
    expect(service.validate(result('你记录了旅行。', ['topic:旅行']), snapshot, plan)).toEqual({ ok: false, reason: 'UNKNOWN_FACT' });
  });

  it('rejects invented numeric claims and changed page structure', () => {
    const service = new SummaryValidationService();
    expect(service.validate(result('这个月，你留下了999段记忆。'), snapshot, plan)).toEqual({ ok: false, reason: 'UNKNOWN_NUMBER' });
    expect(service.validate({ ok: true, pages: [] }, snapshot, plan)).toEqual({ ok: false, reason: 'PAGE_STRUCTURE' });
    expect(service.validate({ ok: true, pages: [{ ...result('你记录了开心。').pages[0], pageType: 'COVER' }] }, snapshot, plan)).toEqual({ ok: false, reason: 'PAGE_STRUCTURE' });
  });

  it('passes adapter failures through for template fallback', () => {
    expect(new SummaryValidationService().validate({ ok: false, reason: 'TIMEOUT' }, snapshot, plan)).toEqual({ ok: false, reason: 'TIMEOUT' });
  });
});
