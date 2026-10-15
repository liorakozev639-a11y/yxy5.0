import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MemorySearchFilters } from './MemorySearchFilters';

const catalog = {
  moods: ['开心', '平静'],
  statuses: ['散步', '约会'],
  topics: [{ id: 'topic-love', name: '恋爱' }, { id: 'topic-exam', name: '考研' }],
};

describe('MemorySearchFilters', () => {
  it('shows one mood group and multi-select status/topic groups', () => {
    const html = renderToStaticMarkup(<MemorySearchFilters value={{ mood: '开心', statusValues: ['散步'], topicIds: ['topic-love'] }} catalog={catalog} onChange={() => undefined} />);
    expect(html).toContain('心情（单选）');
    expect(html).toContain('状态（可多选）');
    expect(html).toContain('主题（可多选）');
    expect(html).toContain('aria-pressed="true"');
  });

  it('replaces mood and toggles status/topic values through controlled callbacks', () => {
    const onChange = vi.fn();
    const tree = MemorySearchFilters({ value: { mood: '开心', statusValues: ['散步'], topicIds: ['topic-love'] }, catalog, onChange });
    findButton(tree, '平静').props.onClick();
    findButton(tree, '约会').props.onClick();
    findButton(tree, '考研').props.onClick();

    expect(onChange).toHaveBeenNthCalledWith(1, expect.objectContaining({ mood: '平静' }));
    expect(onChange).toHaveBeenNthCalledWith(2, expect.objectContaining({ statusValues: ['散步', '约会'] }));
    expect(onChange).toHaveBeenNthCalledWith(3, expect.objectContaining({ topicIds: ['topic-love', 'topic-exam'] }));
  });
});

function findButton(node: ReactNode, text: string): ReactElement<any> {
  if (!node || typeof node !== 'object') throw new Error(`找不到按钮：${text}`);
  const element = node as ReactElement<any>;
  if (element.props?.children === text && typeof element.props?.onClick === 'function') return element;
  const children = Array.isArray(element.props?.children) ? element.props.children : [element.props?.children];
  for (const child of children) {
    try { return findButton(child, text); } catch { /* continue */ }
  }
  throw new Error(`找不到按钮：${text}`);
}
