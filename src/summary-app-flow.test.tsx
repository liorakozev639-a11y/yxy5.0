import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SummaryConsentDialog } from './App';
import type { MemoryStorySummary, SummaryListItem, SummaryReflection } from './domain/memory-summary';
import { initialSummaryFlowState, summaryFlowReducer } from './hooks/use-memory-summaries';

const item: SummaryListItem = {
  id: 'summary-1', periodType: 'MONTH', periodKey: '2026-09', status: 'READY', generationMode: 'TEMPLATE', isCompact: false,
  viewedAt: null, lastViewedPage: 0, version: 1, createdAt: '', generatedAt: '', updatedAt: '',
};
const detail: MemoryStorySummary = {
  ...item,
  pages: [{ id: 'page-1', summaryId: 'summary-1', pageType: 'COVER', displayOrder: 0, narration: '你看见了自己。', originalNarration: '你看见了自己。', payload: {}, isUserEdited: false, version: 1 }],
  reflection: null,
};

describe('emotional summary app flow', () => {
  it('keeps defer local and preserves progress, edits and reflection through reopen', () => {
    let state = summaryFlowReducer(initialSummaryFlowState, { type: 'checked', dueResult: { needsConsent: false, due: [item], pendingPeriods: [] }, preference: undefined });
    state = summaryFlowReducer(state, { type: 'reminder_dismissed' });
    expect(state.dueResult?.due[0].viewedAt).toBeNull();

    state = summaryFlowReducer(state, { type: 'summary_opened', summary: detail });
    state = summaryFlowReducer(state, { type: 'progress_saved', summary: { ...detail, lastViewedPage: 1, version: 2 } });
    state = summaryFlowReducer(state, { type: 'mode_changed', mode: 'archive' });
    state = summaryFlowReducer(state, { type: 'summary_opened', summary: state.active! });
    expect(state.active?.lastViewedPage).toBe(1);

    const editedPage = { ...detail.pages[0], narration: '你修改了这段旁白。', version: 2 };
    state = summaryFlowReducer(state, { type: 'page_saved', page: editedPage });
    expect(state.active?.pages[0].narration).toBe('你修改了这段旁白。');

    const reflection: SummaryReflection = { id: 'reflection-1', summaryId: 'summary-1', userId: 'local-user', text: '你会继续认真生活。', createdAt: '', updatedAt: '' };
    state = summaryFlowReducer(state, { type: 'reflection_saved', reflection });
    expect(state.reflections[0].text).toContain('认真生活');
    expect(state.active?.reflection?.id).toBe('reflection-1');
  });

  it('explains first-use authorization with text and photos enabled independently', () => {
    const html = renderToStaticMarkup(<SummaryConsentDialog onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(html).toContain('生成总结前，请先确认授权');
    expect(html).toContain('允许使用文字');
    expect(html).toContain('允许使用照片');
    expect((html.match(/checked=""/g) ?? [])).toHaveLength(2);
    expect(html).toContain('云端 AI');
  });
});
