import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { addSearchKeyword, MemorySearchFilters, removeSearchKeyword } from './MemorySearchFilters';

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

  it('converts inclusive calendar dates into Shanghai start and exclusive end instants', () => {
    const onChange = vi.fn();
    const tree = MemorySearchFilters({ value: {}, catalog, onChange });
    const dateInputs = findElements(tree, 'input').filter((element) => element.props.type === 'date');
    dateInputs[0].props.onChange({ target: { value: '2026-10-01' } });
    dateInputs[1].props.onChange({ target: { value: '2026-10-01' } });

    expect(onChange).toHaveBeenNthCalledWith(1, expect.objectContaining({ from: '2026-09-30T16:00:00.000Z' }));
    expect(onChange).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: '2026-10-01T16:00:00.000Z' }));
  });

  it('lets people add and remove independent search keywords', () => {
    expect(addSearchKeyword(['海边'], ' 日落 ')).toEqual(['海边', '日落']);
    expect(addSearchKeyword(['海边', '日落'], '海边')).toEqual(['海边', '日落']);
    expect(removeSearchKeyword(['海边', '日落'], '海边')).toEqual(['日落']);

    const html = renderToStaticMarkup(<MemorySearchFilters value={{ keywords: ['海边'] }} catalog={catalog} onChange={() => undefined} />);
    expect(html).toContain('关键词（全部都要匹配）');
    expect(html).toContain('删除关键词：海边');
  });

  it('shows the same implicit sort that the request layer will use', () => {
    const keywordHtml = renderToStaticMarkup(<MemorySearchFilters value={{ keywords: ['海边'] }} catalog={catalog} onChange={() => undefined} />);
    const browseHtml = renderToStaticMarkup(<MemorySearchFilters value={{}} catalog={catalog} onChange={() => undefined} />);
    expect(keywordHtml).toContain('<option value="RELEVANCE" selected="">最相关</option>');
    expect(browseHtml).toContain('<option value="NEWEST" selected="">时间从新到旧</option>');
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

function findElements(node: ReactNode, type: string): ReactElement<any>[] {
  if (!node || typeof node !== 'object') return [];
  const element = node as ReactElement<any>;
  const matches = element.type === type ? [element] : [];
  const children = Array.isArray(element.props?.children) ? element.props.children : [element.props?.children];
  return [...matches, ...children.flatMap((child: ReactNode) => findElements(child, type))];
}
