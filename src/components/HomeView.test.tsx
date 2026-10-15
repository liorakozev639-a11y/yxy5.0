import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { HomeView } from './HomeView';

describe('HomeView', () => {
  it('shows the memory echo entry above the memory toolbar', () => {
    const html = renderToStaticMarkup(<HomeView echoCard={<aside>来自三年前的问候</aside>} imageUrls={{}} memories={[]} onAdd={() => undefined} onOpenSearch={() => undefined} onSelect={() => undefined} />);
    expect(html).toContain('来自三年前的问候');
    expect(html.indexOf('来自三年前的问候')).toBeLessThan(html.indexOf('所有记忆'));
  });

  it('shows the emotional-summary reminder above the memory toolbar', () => {
    const html = renderToStaticMarkup(<HomeView imageUrls={{}} memories={[]} onAdd={() => undefined} onOpenSearch={() => undefined} onSelect={() => undefined} summaryCard={<aside>上个月的月度总结已经生成好了</aside>} />);
    expect(html.indexOf('上个月的月度总结已经生成好了')).toBeGreaterThan(-1);
    expect(html.indexOf('上个月的月度总结已经生成好了')).toBeLessThan(html.indexOf('所有记忆'));
  });

  it('opens the dedicated search page instead of filtering memories locally', () => {
    const onOpenSearch = vi.fn();
    const tree = HomeView({
      imageUrls: { one: '/one' },
      memories: [{ id: 'one', imageBlob: new Blob(), imageName: 'one.jpg', eventAt: '2026-10-01T00:00:00.000Z', title: '图书馆', note: '', mood: '', statuses: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }],
      onAdd: () => undefined,
      onOpenSearch,
      onSelect: () => undefined,
    });
    findElementByClass(tree, 'home-search-entry').props.onClick();
    const html = renderToStaticMarkup(tree);

    expect(onOpenSearch).toHaveBeenCalledWith('');
    expect(html).toContain('图书馆');
    expect(html).not.toContain('没有找到这段记忆');
  });

  it('uses a clear button-like entry instead of an input that navigates before typing', () => {
    const onOpenSearch = vi.fn();
    const tree = HomeView({ imageUrls: {}, memories: [], onAdd: () => undefined, onOpenSearch, onSelect: () => undefined });
    expect(() => findElement(tree, 'input')).toThrow();
    findElementByClass(tree, 'home-search-entry').props.onClick();
    expect(onOpenSearch).toHaveBeenCalledWith('');
  });
});

function findElementByClass(node: ReactNode, className: string): ReactElement<any> {
  if (!node || typeof node !== 'object') throw new Error(`找不到元素：${className}`);
  const element = node as ReactElement<any>;
  if (String(element.props?.className ?? '').split(' ').includes(className)) return element;
  const children = Array.isArray(element.props?.children) ? element.props.children : [element.props?.children];
  for (const child of children) {
    try { return findElementByClass(child, className); } catch { /* continue */ }
  }
  throw new Error(`找不到元素：${className}`);
}

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
