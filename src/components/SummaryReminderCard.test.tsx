import React, { type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SummaryListItem } from '../domain/memory-summary';
import { SummaryReminderCard } from './SummaryReminderCard';

const ready = (periodType: 'MONTH' | 'YEAR', overrides: Partial<SummaryListItem> = {}): SummaryListItem => ({
  id: `summary-${periodType}`, periodType, periodKey: periodType === 'MONTH' ? '2026-09' : '2025', status: 'READY',
  generationMode: 'TEMPLATE', isCompact: false, viewedAt: null, lastViewedPage: 0, version: 1,
  createdAt: '', generatedAt: '', updatedAt: '', ...overrides,
});

describe('SummaryReminderCard', () => {
  it('announces monthly and yearly summaries in user-facing language', () => {
    const monthly = renderToStaticMarkup(<SummaryReminderCard due={[ready('MONTH')]} onLater={() => undefined} onOpen={() => undefined} />);
    const yearly = renderToStaticMarkup(<SummaryReminderCard due={[ready('YEAR')]} onLater={() => undefined} onOpen={() => undefined} />);
    const both = renderToStaticMarkup(<SummaryReminderCard due={[ready('MONTH'), ready('YEAR')]} onLater={() => undefined} onOpen={() => undefined} />);

    expect(monthly).toContain('上个月的月度总结已经生成好了');
    expect(yearly).toContain('上一年的年度总结已经生成好了');
    expect(both).toContain('月度总结和年度总结');
  });

  it('opens the newest ready summary or lets the user defer the reminder', () => {
    const onOpen = vi.fn();
    const onLater = vi.fn();
    const tree = SummaryReminderCard({ due: [ready('MONTH')], onOpen, onLater });
    const buttons = findButtons(tree);
    buttons.find((button) => button.props.children === '现在查看')?.props.onClick();
    buttons.find((button) => button.props.children === '稍后提醒')?.props.onClick();

    expect(onOpen).toHaveBeenCalledWith('summary-MONTH');
    expect(onLater).toHaveBeenCalledOnce();
  });

  it('renders nothing when no unread ready summary exists', () => {
    const failed = ready('MONTH', { status: 'FAILED' });
    const viewed = ready('YEAR', { viewedAt: '2026-01-01T00:00:00.000Z' });
    expect(renderToStaticMarkup(<SummaryReminderCard due={[failed, viewed]} onLater={() => undefined} onOpen={() => undefined} />)).toBe('');
  });
});

function findButtons(node: ReactNode): ReactElement<any>[] {
  if (!React.isValidElement(node)) return [];
  const element = node as ReactElement<any>;
  const children = React.Children.toArray(element.props.children).flatMap(findButtons);
  return element.type === 'button' ? [element, ...children] : children;
}
