import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MemoryStorySummary } from '../domain/memory-summary';
import { closeStoryPlayer, resolveNavigationIndex, summaryProgressPercent, SummaryStoryPlayer, touchNavigationIntent, wheelNavigationIntent } from './SummaryStoryPlayer';

const summary: MemoryStorySummary = {
  id: 'summary-1', periodType: 'MONTH', periodKey: '2026-09', status: 'READY', generationMode: 'TEMPLATE', isCompact: false,
  viewedAt: null, lastViewedPage: 0, version: 1, createdAt: '', generatedAt: '', updatedAt: '', reflection: null,
  pages: ['COVER', 'MOOD', 'REFLECTION'].map((pageType, index) => ({ id: `page-${index}`, summaryId: 'summary-1', pageType: pageType as any, displayOrder: index, narration: `你看到第${index + 1}页`, originalNarration: '', payload: index === 0 ? { label: '2026年9月' } : {}, isUserEdited: false, version: 1 })),
};

describe('SummaryStoryPlayer', () => {
  it('moves at most one page for buttons, keys, wheel and touch intents', () => {
    expect(resolveNavigationIndex(1, 3, 'next')).toBe(2);
    expect(resolveNavigationIndex(1, 3, 'previous')).toBe(0);
    expect(resolveNavigationIndex(2, 3, 'next')).toBe(2);
    expect(wheelNavigationIntent(80)).toBe('next');
    expect(wheelNavigationIntent(-80)).toBe('previous');
    expect(wheelNavigationIntent(5)).toBeNull();
    expect(touchNavigationIntent(200, 120)).toBe('next');
    expect(touchNavigationIntent(120, 200)).toBe('previous');
  });

  it('renders visible controls and an accurate progress bar without audio', () => {
    const html = renderToStaticMarkup(<SummaryStoryPlayer initialPage={1} onClose={() => undefined} onEdit={() => undefined} onProgress={() => undefined} onReflect={() => undefined} summary={summary} />);
    expect(summaryProgressPercent(1, 3)).toBeCloseTo(66.67, 1);
    expect(html).toContain('aria-valuenow="67"');
    expect(html).toContain('上一页');
    expect(html).toContain('下一页');
    expect(html).toContain('编辑这部电影');
    expect(html).not.toContain('<audio');
  });

  it('persists the current page before closing', () => {
    const onProgress = vi.fn();
    const onClose = vi.fn();
    closeStoryPlayer(2, onProgress, onClose);
    expect(onProgress).toHaveBeenCalledWith(2, false);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
