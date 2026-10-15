import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  normalizeMemorySearchCriteria,
  type MemorySearchCriteria,
  type MemorySearchPage,
  type MemorySearchRelaxation,
  type MemorySearchRequest,
  type ParsedMemorySearch,
  type SearchCatalog,
} from '../domain/memory-search';
import { parseMemorySearchInput } from '../domain/memory-query-parser';
import { initialMemorySearchState, memorySearchReducer, resolveRefreshAnchor, type MemorySearchAction } from '../domain/memory-search-state';
import type { ApiMemoryRepository } from '../repositories/api-memory-repository';
import type { createMemorySearchHistory } from '../storage/memory-search-history';

type SearchRepository = Pick<ApiMemoryRepository, 'search'>;
type SearchHistory = ReturnType<typeof createMemorySearchHistory>;

export function useMemorySearch({
  repository,
  catalog,
  history,
}: {
  repository: SearchRepository;
  catalog: SearchCatalog;
  history: SearchHistory;
}) {
  const [state, dispatch] = useReducer(memorySearchReducer, initialMemorySearchState);
  const stateRef = useRef(state);
  const requestSequence = useRef(0);
  const [inputText, setInputText] = useState('');
  const [parsed, setParsed] = useState<ParsedMemorySearch>();
  const [recentSearches, setRecentSearches] = useState(() => history.validate(catalog));

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { setRecentSearches(history.validate(catalog)); }, [catalog, history]);

  const send = useCallback((action: MemorySearchAction) => {
    stateRef.current = memorySearchReducer(stateRef.current, action);
    dispatch(action);
  }, []);

  const execute = useCallback(async (
    request: MemorySearchRequest,
    options: { append?: boolean; preserveItems?: boolean } = {},
  ) => {
    const requestId = ++requestSequence.current;
    const append = options.append ?? false;
    send({ type: 'started', requestId, request, append, preserveItems: options.preserveItems });
    try {
      const page = await repository.search(request);
      send({ type: 'loaded', requestId, page, append });
      return page;
    } catch (error) {
      send({ type: 'failed', requestId, error: readableError(error) });
      return undefined;
    }
  }, [repository, send]);

  const parse = useCallback((text: string, now = new Date()) => {
    setInputText(text);
    const result = parseMemorySearchInput(text, catalog, now);
    setParsed(result);
    return result;
  }, [catalog]);

  const confirm = useCallback(async (criteria?: MemorySearchCriteria, displayText = inputText) => {
    const source = criteria ?? {
      ...(parsed?.criteria ?? {}),
      ...(parsed?.pendingKeywords.length ? { keywords: parsed.pendingKeywords } : {}),
    };
    const normalized = normalizeMemorySearchCriteria(source);
    const request: MemorySearchRequest = {
      ...normalized,
      matchMode: normalized.matchMode ?? 'EXACT',
      sort: normalized.sort ?? (normalized.keywords?.length ? 'RELEVANCE' : 'NEWEST'),
      pageSize: 5,
    };
    const page = await execute(request);
    if (hasCriteria(normalized)) {
      history.save({ id: createHistoryId(), displayText: displayText.trim() || describeCriteria(normalized), criteria: normalized, createdAt: new Date().toISOString() });
      setRecentSearches(history.validate(catalog));
    }
    return page;
  }, [catalog, execute, history, inputText, parsed]);

  const loadMore = useCallback(async () => {
    const current = stateRef.current;
    if (!current.request || !current.nextCursor || current.status === 'loading') return undefined;
    return execute({ ...withoutCursor(current.request), cursor: current.nextCursor, pageSize: 5 }, { append: true, preserveItems: true });
  }, [execute]);

  const retry = useCallback(async () => {
    const current = stateRef.current;
    if (!current.request) return undefined;
    return execute(current.request, { append: Boolean(current.request.cursor && current.items.length), preserveItems: true });
  }, [execute]);

  const useFuzzySearch = useCallback(async () => {
    const current = stateRef.current;
    if (!current.request) return undefined;
    return execute({ ...withoutCursor(current.request), matchMode: 'FUZZY', pageSize: 5 }, { preserveItems: true });
  }, [execute]);

  const relax = useCallback(async (suggestion: MemorySearchRelaxation) => {
    const current = stateRef.current;
    if (!current.request) return undefined;
    const request = removeRelaxedCondition(withoutCursor(current.request), suggestion);
    return execute({ ...request, pageSize: 5 });
  }, [execute]);

  const refreshLoadedPages = useCallback(async (anchorId?: string) => {
    const current = stateRef.current;
    if (!current.request) return undefined;
    const targetPages = Math.max(current.loadedPages, 1);
    const requestId = ++requestSequence.current;
    const baseRequest = withoutCursor(current.request);
    send({ type: 'started', requestId, request: baseRequest, append: false, preserveItems: true });
    try {
      const items: MemorySearchPage['items'] = [];
      let cursor: string | undefined;
      let lastPage: MemorySearchPage = { items: [], total: 0 };
      let loadedPages = 0;
      for (let index = 0; index < targetPages; index += 1) {
        lastPage = await repository.search({ ...baseRequest, ...(cursor ? { cursor } : {}), pageSize: 5 });
        items.push(...lastPage.items);
        loadedPages += 1;
        cursor = lastPage.nextCursor;
        if (!cursor) break;
      }
      const page: MemorySearchPage = {
        items,
        total: lastPage.total,
        ...(cursor ? { nextCursor: cursor } : {}),
        ...(lastPage.relaxationSuggestions ? { relaxationSuggestions: lastPage.relaxationSuggestions } : {}),
      };
      send({ type: 'refreshed', requestId, page, loadedPages, anchorId: resolveRefreshAnchor(current.items, items, anchorId) });
      return page;
    } catch (error) {
      send({ type: 'failed', requestId, error: readableError(error) });
      return undefined;
    }
  }, [repository, send]);

  const removeHistory = useCallback((id: string) => {
    history.remove(id);
    setRecentSearches(history.validate(catalog));
  }, [catalog, history]);

  const clearHistory = useCallback(() => {
    history.clear();
    setRecentSearches([]);
  }, [history]);

  const clear = useCallback(() => {
    requestSequence.current += 1;
    setInputText('');
    setParsed(undefined);
    send({ type: 'cleared' });
  }, [send]);

  const setAnchor = useCallback((anchorId?: string) => send({ type: 'anchor', anchorId }), [send]);

  return {
    ...state,
    inputText,
    parsed,
    recentSearches,
    setInputText,
    parse,
    confirm,
    loadMore,
    retry,
    useFuzzySearch,
    relax,
    refreshLoadedPages,
    removeHistory,
    clearHistory,
    clear,
    setAnchor,
  };
}

function withoutCursor(request: MemorySearchRequest): MemorySearchRequest {
  const { cursor: _cursor, ...rest } = request;
  return { ...rest, pageSize: 5 };
}

function removeRelaxedCondition(request: MemorySearchRequest, suggestion: MemorySearchRelaxation): MemorySearchRequest {
  if (suggestion.field === 'from') return { ...request, from: undefined };
  if (suggestion.field === 'to') return { ...request, to: undefined };
  if (suggestion.field === 'mood') return { ...request, mood: undefined };
  if (suggestion.field === 'status') return { ...request, statusValues: request.statusValues?.filter((value) => value !== suggestion.value) };
  if (suggestion.field === 'topic') return { ...request, topicIds: request.topicIds?.filter((value) => value !== suggestion.value) };
  return { ...request, keywords: request.keywords?.filter((value) => value !== suggestion.value) };
}

function hasCriteria(criteria: MemorySearchCriteria) {
  return Boolean(criteria.from || criteria.to || criteria.mood || criteria.statusValues?.length || criteria.topicIds?.length || criteria.keywords?.length);
}

function createHistoryId() {
  return globalThis.crypto?.randomUUID?.() ?? `search-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function describeCriteria(criteria: MemorySearchCriteria) {
  return [...(criteria.keywords ?? []), criteria.mood, ...(criteria.statusValues ?? [])].filter(Boolean).join(' · ') || '全部记忆';
}

function readableError(error: unknown) {
  return error instanceof Error && error.message ? error.message : '寻迹暂时失败，请稍后重试。';
}
