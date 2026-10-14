import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MemoryStorySummary } from '../domain/memory-summary';
import { buildReflectionInput, SummaryReflectionEditor } from './SummaryReflectionEditor';

const summary: MemoryStorySummary = {
  id: 'summary-1', periodType: 'YEAR', periodKey: '2025', status: 'READY', generationMode: 'TEMPLATE', isCompact: false,
  viewedAt: null, lastViewedPage: 0, version: 1, createdAt: '', generatedAt: '', updatedAt: '', reflection: null,
  pages: [{ id: 'page-1', summaryId: 'summary-1', pageType: 'MEMORY', displayOrder: 0, narration: '你', originalNarration: '你', payload: { memories: [{ id: 'memory-1', mediaId: 'media-1', imageUrl: '/api/media/media-1/file', title: '海边' }] }, isUserEdited: false, version: 1 }],
};

describe('SummaryReflectionEditor', () => {
  it('does not create a save payload for empty text', () => {
    expect(buildReflectionInput('   ', 'media-1')).toBeNull();
    expect(buildReflectionInput('  你已经走了很远。 ', 'media-1')).toEqual({ text: '你已经走了很远。', coverMediaId: 'media-1' });
  });

  it('renders a dedicated reflection form and does not expose ordinary-memory creation', () => {
    const onSave = vi.fn();
    const html = renderToStaticMarkup(<SummaryReflectionEditor initialText="" onCancel={() => undefined} onSave={onSave} summary={summary} />);
    expect(html).toContain('写给未来的你');
    expect(html).toContain('选择感言封面');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('创建普通记忆');
    expect(onSave).not.toHaveBeenCalled();
  });
});
