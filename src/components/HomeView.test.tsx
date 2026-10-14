import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeView } from './HomeView';

describe('HomeView', () => {
  it('shows the memory echo entry above the memory toolbar', () => {
    const html = renderToStaticMarkup(<HomeView echoCard={<aside>来自三年前的问候</aside>} imageUrls={{}} memories={[]} onAdd={() => undefined} onQueryChange={() => undefined} onSelect={() => undefined} query="" />);
    expect(html).toContain('来自三年前的问候');
    expect(html.indexOf('来自三年前的问候')).toBeLessThan(html.indexOf('所有记忆'));
  });

  it('shows the emotional-summary reminder above the memory toolbar', () => {
    const html = renderToStaticMarkup(<HomeView imageUrls={{}} memories={[]} onAdd={() => undefined} onQueryChange={() => undefined} onSelect={() => undefined} query="" summaryCard={<aside>上个月的月度总结已经生成好了</aside>} />);
    expect(html.indexOf('上个月的月度总结已经生成好了')).toBeGreaterThan(-1);
    expect(html.indexOf('上个月的月度总结已经生成好了')).toBeLessThan(html.indexOf('所有记忆'));
  });
});
