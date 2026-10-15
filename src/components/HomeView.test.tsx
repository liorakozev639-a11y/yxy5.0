import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { HomeView } from './HomeView';

describe('HomeView', () => {
  it('shows the memory echo entry above the memory toolbar', () => {
    const html = renderToStaticMarkup(<HomeView echoCard={<aside>来自三年前的问候</aside>} imageUrls={{}} memories={[]} onAdd={() => undefined} onOpenSearch={() => undefined} onQueryChange={() => undefined} onSelect={() => undefined} query="" />);
    expect(html).toContain('来自三年前的问候');
    expect(html.indexOf('来自三年前的问候')).toBeLessThan(html.indexOf('所有记忆'));
  });

  it('shows the emotional-summary reminder above the memory toolbar', () => {
    const html = renderToStaticMarkup(<HomeView imageUrls={{}} memories={[]} onAdd={() => undefined} onOpenSearch={() => undefined} onQueryChange={() => undefined} onSelect={() => undefined} query="" summaryCard={<aside>上个月的月度总结已经生成好了</aside>} />);
    expect(html.indexOf('上个月的月度总结已经生成好了')).toBeGreaterThan(-1);
    expect(html.indexOf('上个月的月度总结已经生成好了')).toBeLessThan(html.indexOf('所有记忆'));
  });

  it('hands the homepage phrase to memory search instead of filtering locally', () => {
    const onOpenSearch = vi.fn();
    const tree = HomeView({
      imageUrls: { one: '/one' },
      memories: [{ id: 'one', imageBlob: new Blob(), imageName: 'one.jpg', eventAt: '2026-10-01T00:00:00.000Z', title: '图书馆', note: '', mood: '', statuses: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }],
      onAdd: () => undefined,
      onOpenSearch,
      onQueryChange: () => undefined,
      onSelect: () => undefined,
      query: '海边',
    });
    const form = findElement(tree, 'form');
    form.props.onSubmit({ preventDefault: vi.fn() });
    const html = renderToStaticMarkup(tree);

    expect(onOpenSearch).toHaveBeenCalledWith('海边');
    expect(html).toContain('图书馆');
    expect(html).not.toContain('没有找到这段记忆');
  });
});

function findElement(node: ReactNode, type: string): ReactElement<any> {
  if (!node || typeof node !== 'object') throw new Error(`找不到元素：${type}`);
  const element = node as ReactElement<any>;
  if (element.type === type) return element;
  const children = Array.isArray(element.props?.children) ? element.props.children : [element.props?.children];
  for (const child of children) {
    try { return findElement(child, type); } catch { /* continue */ }
  }
  throw new Error(`找不到元素：${type}`);
}
