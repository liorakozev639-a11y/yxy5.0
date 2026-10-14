import { describe, expect, it } from 'vitest';
import { isReadySummary, nextReadablePage, shouldShowDueSummary, type MemoryStorySummary } from './memory-summary';

function summary(overrides: Partial<MemoryStorySummary> = {}): MemoryStorySummary {
  return {
    id: 'summary-1', periodType: 'MONTH', periodKey: '2026-09', status: 'READY', generationMode: 'TEMPLATE',
    isCompact: false, viewedAt: null, lastViewedPage: 0, version: 1, createdAt: '', generatedAt: '', updatedAt: '',
    pages: [
      { id: 'page-1', summaryId: 'summary-1', pageType: 'COVER', displayOrder: 0, narration: '你', originalNarration: '你', payload: {}, isUserEdited: false, version: 1 },
      { id: 'page-2', summaryId: 'summary-1', pageType: 'CLOSING', displayOrder: 1, narration: '你', originalNarration: '你', payload: {}, isUserEdited: false, version: 1 },
    ],
    reflection: null,
    ...overrides,
  };
}

describe('memory summary helpers', () => {
  it('recognizes only ready summaries', () => {
    expect(isReadySummary(summary())).toBe(true);
    expect(isReadySummary(summary({ status: 'FAILED' }))).toBe(false);
    expect(isReadySummary({ status: 'NO_CONTENT' })).toBe(false);
  });

  it('clamps the saved page to a readable page index', () => {
    expect(nextReadablePage(summary({ lastViewedPage: 1 }))).toBe(1);
    expect(nextReadablePage(summary({ lastViewedPage: 99 }))).toBe(1);
    expect(nextReadablePage(summary({ lastViewedPage: -2 }))).toBe(0);
    expect(nextReadablePage(summary({ pages: [] }))).toBe(0);
  });

  it('shows a reminder only when there is an unread ready summary', () => {
    expect(shouldShowDueSummary({ needsConsent: false, due: [summary()], pendingPeriods: [] })).toBe(true);
    expect(shouldShowDueSummary({ needsConsent: false, due: [summary({ status: 'FAILED' })], pendingPeriods: [] })).toBe(false);
    expect(shouldShowDueSummary({ needsConsent: false, due: [summary({ viewedAt: '2026-10-01T00:00:00.000Z' })], pendingPeriods: [] })).toBe(false);
    expect(shouldShowDueSummary({ needsConsent: true, due: [summary()], pendingPeriods: [] })).toBe(false);
  });
});
