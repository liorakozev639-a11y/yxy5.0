import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MemoryStorySummary } from '../domain/memory-summary';
import { isSummaryVersionConflict, SummaryStoryEditor } from './SummaryStoryEditor';

const summary: MemoryStorySummary = {
  id: 'summary-1', periodType: 'MONTH', periodKey: '2026-09', status: 'READY', generationMode: 'TEMPLATE', isCompact: false,
  viewedAt: null, lastViewedPage: 0, version: 1, createdAt: '', generatedAt: '', updatedAt: '', reflection: null,
  pages: [{ id: 'page-1', summaryId: 'summary-1', pageType: 'MEMORY', displayOrder: 0, narration: '你记住了海风。', originalNarration: '你记住了海风。', payload: { memories: [{ id: 'memory-1', mediaId: 'media-1', title: '海边' }] }, isUserEdited: false, version: 3 }],
};

describe('SummaryStoryEditor', () => {
  it('offers narration, photo, order and confirmed regeneration controls', () => {
    const html = renderToStaticMarkup(<SummaryStoryEditor onClose={() => undefined} onRegenerate={async () => undefined} onReorder={async () => summary.pages[0]} onSavePage={async () => summary.pages[0]} summary={summary} />);
    expect(html).toContain('编辑旁白');
    expect(html).toContain('替换代表照片');
    expect(html).toContain('页面顺序');
    expect(html).toContain('重新生成');
    expect(html).toContain('保存这一页');
  });

  it('recognizes optimistic-lock conflicts so stale edits can ask for a reload', () => {
    expect(isSummaryVersionConflict({ status: 409 })).toBe(true);
    expect(isSummaryVersionConflict({ status: 500 })).toBe(false);
  });
});
