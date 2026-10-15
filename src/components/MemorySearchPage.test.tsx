import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MemorySearchItem } from '../domain/memory-search';
import { cleanReusedHistoryCriteria, MemorySearchPage, shouldAutoBrowseMemories } from './MemorySearchPage';

const catalog = { moods: ['开心'], statuses: ['散步'], topics: [{ id: 'topic-love', name: '恋爱' }] };
const baseFlow = {
  status: 'idle' as const,
  items: [] as MemorySearchItem[],
  total: 0,
  relaxationSuggestions: [],
  requestId: 0,
  loadedPages: 0,
  inputText: '',
  parsed: undefined,
  recentSearches: [],
  setInputText: vi.fn(), parse: vi.fn(), confirm: vi.fn(), loadMore: vi.fn(), retry: vi.fn(), useFuzzySearch: vi.fn(), relax: vi.fn(),
  refreshLoadedPages: vi.fn(), removeHistory: vi.fn(), clearHistory: vi.fn(), clear: vi.fn(),
};

describe('MemorySearchPage', () => {
  it('describes no-condition mode as browsing all memories', () => {
    const html = renderToStaticMarkup(<MemorySearchPage catalog={catalog} flow={baseFlow} onSelect={() => undefined} />);
    expect(html).toContain('浏览全部记忆');
    expect(html).toContain('描述你想找的经历');
  });

  it('shows parsed conditions for explicit confirmation', () => {
    const flow = { ...baseFlow, parsed: { criteria: { mood: '开心' }, pendingKeywords: ['海边'], recognized: [{ type: 'mood' as const, label: '开心' }] } };
    const html = renderToStaticMarkup(<MemorySearchPage catalog={catalog} flow={flow} onSelect={() => undefined} />);
    expect(html).toContain('我理解的是这些条件');
    expect(html).toContain('海边');
    expect(html).toContain('开始寻迹');
    expect(html).toContain('aria-pressed="true"');
  });

  it('offers user-confirmed fuzzy search and no more than three relaxation suggestions for exact empty results', () => {
    const flow = {
      ...baseFlow,
      status: 'ready' as const,
      request: { keywords: ['海边'], matchMode: 'EXACT' as const, pageSize: 5 as const },
      relaxationSuggestions: [
        { field: 'keyword' as const, value: '海边', resultCount: 5 },
        { field: 'mood' as const, value: '开心', resultCount: 4 },
        { field: 'topic' as const, value: 'topic-love', resultCount: 3 },
        { field: 'status' as const, value: '散步', resultCount: 2 },
      ],
    };
    const html = renderToStaticMarkup(<MemorySearchPage catalog={catalog} flow={flow} onSelect={() => undefined} />);
    expect(html).toContain('没有找到完全匹配的记忆');
    expect(html).toContain('尝试错别字模糊搜索');
    expect((html.match(/移除“/g) ?? [])).toHaveLength(3);
  });

  it('keeps results visible while appending and after a load error', () => {
    const item = { id: 'one', imageBlob: new Blob(), imageName: 'one.jpg', imageUrl: '/one', eventAt: '2026-10-01T10:00:00+08:00', title: '还在这里', note: '', mood: '', statuses: [], createdAt: '2026-10-01T10:00:00+08:00', updatedAt: '2026-10-01T10:00:00+08:00' };
    const loadingHtml = renderToStaticMarkup(<MemorySearchPage catalog={catalog} flow={{ ...baseFlow, status: 'loading', items: [item] }} onSelect={() => undefined} />);
    const errorHtml = renderToStaticMarkup(<MemorySearchPage catalog={catalog} flow={{ ...baseFlow, status: 'error', error: '后端离线', items: [item] }} onSelect={() => undefined} />);
    expect(loadingHtml).toContain('还在这里');
    expect(loadingHtml).toContain('正在继续寻找');
    expect(errorHtml).toContain('还在这里');
    expect(errorHtml).toContain('当前结果可能不完整');
    expect(errorHtml).toContain('重试加载');
  });

  it('loads all memories automatically when the page opens without conditions', () => {
    expect(shouldAutoBrowseMemories(baseFlow, {})).toBe(true);
    expect(shouldAutoBrowseMemories({ ...baseFlow, request: { pageSize: 5 } }, {})).toBe(false);
  });

  it('strips invalid history labels before reusing the search', () => {
    expect(cleanReusedHistoryCriteria({
      id: 'history-1', displayText: '旧条件', createdAt: '2026-10-01T00:00:00.000Z',
      criteria: { mood: '旧心情', statusValues: ['散步', '旧状态'], topicIds: ['topic-love', 'old-topic'] },
      invalidMood: true, invalidStatusValues: ['旧状态'], invalidTopicIds: ['old-topic'],
    })).toEqual({ statusValues: ['散步'], topicIds: ['topic-love'] });
  });
});
