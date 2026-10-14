import React, { type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SummaryListItem, SummaryReflection } from '../domain/memory-summary';
import { SummaryArchivePage } from './SummaryArchivePage';

const item = (periodType: 'MONTH' | 'YEAR', overrides: Partial<SummaryListItem> = {}): SummaryListItem => ({
  id: `summary-${periodType}`, periodType, periodKey: periodType === 'MONTH' ? '2026-09' : '2025', status: 'READY',
  generationMode: 'TEMPLATE', isCompact: false, viewedAt: null, lastViewedPage: 0, version: 1,
  createdAt: '', generatedAt: '', updatedAt: '', ...overrides,
});
const reflection: SummaryReflection = { id: 'reflection-1', summaryId: 'summary-MONTH', userId: 'local-user', text: '你学会了更温柔地看待自己。', coverMediaId: 'media-1', createdAt: '', updatedAt: '' };

describe('SummaryArchivePage', () => {
  it('shows monthly/yearly filters, unread and compact labels, and reflection cards', () => {
    const html = renderToStaticMarkup(<SummaryArchivePage filter="MONTH" onBack={() => undefined} onFilterChange={() => undefined} onOpen={() => undefined} reflections={[reflection]} summaries={[item('MONTH', { isCompact: true }), item('YEAR')]} />);

    expect(html).toContain('月度总结');
    expect(html).toContain('年度总结');
    expect(html).toContain('未读');
    expect(html).toContain('精简版');
    expect(html).toContain('你学会了更温柔地看待自己');
    expect(html).not.toContain('2025 年度回忆');
  });

  it('routes filter and card interactions through callbacks', () => {
    const onFilterChange = vi.fn();
    const onOpen = vi.fn();
    const tree = SummaryArchivePage({ filter: 'MONTH', onBack: () => undefined, onFilterChange, onOpen, reflections: [], summaries: [item('MONTH')] });
    const buttons = findButtons(tree);
    buttons.find((button) => button.props.children === '年度总结')?.props.onClick();
    buttons.find((button) => button.props['data-summary-id'] === 'summary-MONTH')?.props.onClick();

    expect(onFilterChange).toHaveBeenCalledWith('YEAR');
    expect(onOpen).toHaveBeenCalledWith('summary-MONTH');
  });

  it('renders an honest empty state instead of inventing a zero-memory summary', () => {
    const html = renderToStaticMarkup(<SummaryArchivePage filter="MONTH" onBack={() => undefined} onFilterChange={() => undefined} onOpen={() => undefined} reflections={[]} summaries={[]} />);
    expect(html).toContain('还没有月度总结');
    expect(html).not.toContain('0 段记忆');
  });
});

function findButtons(node: ReactNode): ReactElement<any>[] {
  if (!React.isValidElement(node)) return [];
  const element = node as ReactElement<any>;
  const children = React.Children.toArray(element.props.children).flatMap(findButtons);
  return element.type === 'button' ? [element, ...children] : children;
}
