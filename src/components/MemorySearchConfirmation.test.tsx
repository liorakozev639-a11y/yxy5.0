import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MemorySearchConfirmation } from './MemorySearchConfirmation';

const parsed = {
  criteria: { mood: '开心', topicIds: ['topic-love'] },
  pendingKeywords: ['海边'],
  recognized: [{ type: 'time' as const, label: '上个月' }, { type: 'mood' as const, label: '开心' }, { type: 'topic' as const, label: '恋爱' }],
};

describe('MemorySearchConfirmation', () => {
  it('shows recognized chips and disables searching before explicit confirmation', () => {
    const html = renderToStaticMarkup(<MemorySearchConfirmation parsed={parsed} confirmed={false} onConfirmChange={() => undefined} onStart={() => undefined} />);
    expect(html).toContain('上个月');
    expect(html).toContain('开心');
    expect(html).toContain('恋爱');
    expect(html).toContain('海边');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>开始寻迹<\/button>/);
  });

  it('enables searching after the user confirms the parsed conditions', () => {
    const html = renderToStaticMarkup(<MemorySearchConfirmation parsed={parsed} confirmed onConfirmChange={() => undefined} onStart={() => undefined} />);
    expect(html).toMatch(/<button[^>]*>开始寻迹<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>开始寻迹<\/button>/);
  });

  it('lets the user remove a recognized condition before confirmation', () => {
    const onRemove = vi.fn();
    const tree = MemorySearchConfirmation({ parsed, confirmed: false, onConfirmChange: () => undefined, onStart: () => undefined, onRemove });
    findButton(tree, '移除条件：海边').props.onClick();
    expect(onRemove).toHaveBeenCalledWith('keyword', '海边');
  });
});

function findButton(node: ReactNode, label: string): ReactElement<any> {
  if (!node || typeof node !== 'object') throw new Error(`找不到按钮：${label}`);
  const element = node as ReactElement<any>;
  if (element.type === 'button' && element.props?.['aria-label'] === label) return element;
  const children = Array.isArray(element.props?.children) ? element.props.children : [element.props?.children];
  for (const child of children) {
    try { return findButton(child, label); } catch { /* continue */ }
  }
  throw new Error(`找不到按钮：${label}`);
}
