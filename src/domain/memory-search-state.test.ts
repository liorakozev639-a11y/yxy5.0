import { describe, expect, it } from 'vitest';
import type { MemorySearchItem, MemorySearchPage, MemorySearchRequest } from './memory-search';
import { initialMemorySearchState, memorySearchReducer, resolveRefreshAnchor } from './memory-search-state';

const request: MemorySearchRequest = { keywords: ['海边'], matchMode: 'EXACT', sort: 'RELEVANCE', pageSize: 5 };

function item(id: string): MemorySearchItem {
  return {
    id,
    imageBlob: new Blob(),
    imageName: `${id}.jpg`,
    eventAt: '2026-10-01T10:00:00.000Z',
    title: id,
    note: '',
    mood: '',
    statuses: [],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  };
}

function page(ids: string[], overrides: Partial<MemorySearchPage> = {}): MemorySearchPage {
  return { items: ids.map(item), total: ids.length, ...overrides };
}

describe('memorySearchReducer', () => {
  it('loads the first page and resets results for new criteria', () => {
    const loading = memorySearchReducer(initialMemorySearchState, { type: 'started', requestId: 1, request, append: false });
    const loaded = memorySearchReducer(loading, { type: 'loaded', requestId: 1, page: page(['one', 'two'], { total: 7, nextCursor: 'next' }), append: false });
    const reset = memorySearchReducer(loaded, { type: 'started', requestId: 2, request: { ...request, mood: '开心' }, append: false });

    expect(loaded).toMatchObject({ status: 'ready', total: 7, nextCursor: 'next', loadedPages: 1 });
    expect(loaded.items.map((memory) => memory.id)).toEqual(['one', 'two']);
    expect(reset.items).toEqual([]);
    expect(reset.request?.mood).toBe('开心');
  });

  it('appends pages and deduplicates memories by id', () => {
    const first = memorySearchReducer(
      memorySearchReducer(initialMemorySearchState, { type: 'started', requestId: 1, request, append: false }),
      { type: 'loaded', requestId: 1, page: page(['one', 'two'], { total: 3, nextCursor: 'next' }), append: false },
    );
    const loading = memorySearchReducer(first, { type: 'started', requestId: 2, request: { ...request, cursor: 'next' }, append: true });
    const next = memorySearchReducer(loading, { type: 'loaded', requestId: 2, page: page(['two', 'three'], { total: 3 }), append: true });

    expect(next.items.map((memory) => memory.id)).toEqual(['one', 'two', 'three']);
    expect(next.loadedPages).toBe(2);
  });

  it('keeps visible items while retrying and after a retry failure', () => {
    const ready = { ...initialMemorySearchState, status: 'ready' as const, request, items: [item('one')], total: 1, loadedPages: 1 };
    const retrying = memorySearchReducer(ready, { type: 'started', requestId: 4, request, append: false, preserveItems: true });
    const failed = memorySearchReducer(retrying, { type: 'failed', requestId: 4, error: '网络不可用' });

    expect(retrying.items).toHaveLength(1);
    expect(failed).toMatchObject({ status: 'error', error: '网络不可用', items: [{ id: 'one' }] });
  });

  it('keeps no-result relaxation suggestions', () => {
    const loading = memorySearchReducer(initialMemorySearchState, { type: 'started', requestId: 1, request, append: false });
    const next = memorySearchReducer(loading, {
      type: 'loaded', requestId: 1, append: false,
      page: page([], { total: 0, relaxationSuggestions: [{ field: 'keyword', value: '海边', resultCount: 4 }] }),
    });

    expect(next.items).toEqual([]);
    expect(next.relaxationSuggestions).toEqual([{ field: 'keyword', value: '海边', resultCount: 4 }]);
  });

  it('ignores responses from stale request ids', () => {
    const current = memorySearchReducer(initialMemorySearchState, { type: 'started', requestId: 8, request, append: false });
    const next = memorySearchReducer(current, { type: 'loaded', requestId: 7, page: page(['stale']), append: false });
    expect(next).toBe(current);
  });

  it('replaces loaded pages after an edit and keeps the requested scroll anchor', () => {
    const current = { ...initialMemorySearchState, requestId: 3, request, items: [item('old')], loadedPages: 2 };
    const next = memorySearchReducer(current, {
      type: 'refreshed', requestId: 3, page: page(['one', 'two'], { total: 2 }), loadedPages: 2, anchorId: 'two',
    });
    expect(next).toMatchObject({ status: 'ready', loadedPages: 2, anchorId: 'two' });
    expect(next.items.map((memory) => memory.id)).toEqual(['one', 'two']);
  });

  it('removes a deleted or no-longer-matching memory after refresh and keeps items on refresh failure', () => {
    const current = { ...initialMemorySearchState, status: 'ready' as const, requestId: 5, request, items: [item('one'), item('two')], loadedPages: 1 };
    const refreshing = memorySearchReducer(current, { type: 'started', requestId: 6, request, append: false, preserveItems: true });
    const failed = memorySearchReducer(refreshing, { type: 'failed', requestId: 6, error: '离线' });
    const refreshed = memorySearchReducer({ ...current, requestId: 7 }, { type: 'refreshed', requestId: 7, page: page(['two'], { total: 1 }), loadedPages: 1, anchorId: 'one' });

    expect(failed.items.map((memory) => memory.id)).toEqual(['one', 'two']);
    expect(refreshed.items.map((memory) => memory.id)).toEqual(['two']);
  });

  it('falls back to the nearest surviving card when the original anchor disappears', () => {
    expect(resolveRefreshAnchor([item('one'), item('two'), item('three')], [item('one'), item('three')], 'two')).toBe('three');
    expect(resolveRefreshAnchor([item('one')], [], 'one')).toBeUndefined();
  });
});
