import { useEffect, useMemo, useState } from 'react';
import type { MemorySearchCriteria, MemorySearchItem, MemorySearchRelaxation, MemorySearchRequest, ParsedMemorySearch, SearchCatalog } from '../domain/memory-search';
import type { MemorySearchState } from '../domain/memory-search-state';
import type { ValidatedMemorySearchHistoryEntry } from '../storage/memory-search-history';
import { MemorySearchConfirmation } from './MemorySearchConfirmation';
import { MemorySearchFilters } from './MemorySearchFilters';
import { MemorySearchInput } from './MemorySearchInput';
import { MemorySearchTimeline } from './MemorySearchTimeline';

export type MemorySearchFlow = MemorySearchState & {
  inputText: string;
  parsed?: ParsedMemorySearch;
  recentSearches: ValidatedMemorySearchHistoryEntry[];
  setInputText(value: string): void;
  parse(value: string): ParsedMemorySearch;
  confirm(criteria?: MemorySearchCriteria, displayText?: string): Promise<unknown>;
  loadMore(): Promise<unknown>;
  retry(): Promise<unknown>;
  useFuzzySearch(): Promise<unknown>;
  relax(suggestion: MemorySearchRelaxation): Promise<unknown>;
  removeHistory(id: string): void;
  clearHistory(): void;
  clear(): void;
};

export function MemorySearchPage({ catalog, flow, onSelect }: {
  catalog: SearchCatalog;
  flow: MemorySearchFlow;
  onSelect(id: string): void;
}) {
  const [criteria, setCriteria] = useState<MemorySearchCriteria>(() => requestToCriteria(flow.request));
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!flow.parsed) return;
    setCriteria({ ...flow.parsed.criteria, ...(flow.parsed.pendingKeywords.length ? { keywords: flow.parsed.pendingKeywords } : {}) });
    setConfirmed(false);
  }, [flow.parsed]);

  const hasCriteria = criteriaCount(criteria) > 0;
  const confirmation = useMemo(() => flow.parsed ?? criteriaToParsed(criteria, catalog), [catalog, criteria, flow.parsed]);
  const hasSearched = Boolean(flow.request);
  const isEmpty = hasSearched && flow.status === 'ready' && flow.items.length === 0;

  function updateCriteria(next: MemorySearchCriteria) {
    setCriteria(next);
    setConfirmed(false);
  }

  function parseInput(text: string) {
    const result = flow.parse(text);
    setCriteria({ ...result.criteria, ...(result.pendingKeywords.length ? { keywords: result.pendingKeywords } : {}) });
    setConfirmed(false);
  }

  function useHistory(entry: ValidatedMemorySearchHistoryEntry) {
    flow.setInputText(entry.displayText);
    setCriteria(entry.criteria);
    setConfirmed(false);
  }

  return (
    <section className="page-section memory-search-page">
      <div className="page-heading memory-search-heading">
        <div><span className="eyebrow">TRACE YOUR DAYS</span><h1>记忆寻迹</h1><p>用时间、心情、状态、主题和文字，把经历重新找回来。</p></div>
        <div className="memory-search-mode"><span>{hasCriteria ? `${criteriaCount(criteria)} 个条件` : '浏览全部记忆'}</span>{hasSearched && <strong>{flow.total} 段结果</strong>}</div>
      </div>

      <MemorySearchInput
        value={flow.inputText}
        recentSearches={flow.recentSearches}
        onChange={flow.setInputText}
        onParse={parseInput}
        onUseHistory={useHistory}
        onRemoveHistory={flow.removeHistory}
        onClearHistory={flow.clearHistory}
      />
      <MemorySearchFilters value={criteria} catalog={catalog} onChange={updateCriteria} />

      {(hasCriteria || flow.parsed) ? (
        <MemorySearchConfirmation parsed={confirmation} confirmed={confirmed} onConfirmChange={setConfirmed} onStart={() => void flow.confirm(criteria)} />
      ) : !hasSearched ? (
        <div className="memory-search-browse-all"><p>不设置条件时，会按发生时间浏览所有原始记忆。</p><button className="primary-button" type="button" onClick={() => void flow.confirm({}, '浏览全部记忆')}>浏览全部记忆</button></div>
      ) : null}

      {flow.status === 'loading' && flow.items.length === 0 && <div className="memory-search-page-status"><span className="loading-orb">◌</span><p>正在沿着时间寻找…</p></div>}

      {isEmpty && <div className="memory-search-empty">
        <span className="empty-mark">⌁</span>
        <h2>{flow.request?.matchMode === 'FUZZY' ? '仍然没有找到相近的记忆' : '没有找到完全匹配的记忆'}</h2>
        <p>不会自动放宽条件，你可以自己选择下一步。</p>
        {flow.request?.matchMode !== 'FUZZY' && flow.request?.keywords?.length ? <button className="secondary-button" type="button" onClick={() => void flow.useFuzzySearch()}>尝试错别字模糊搜索</button> : null}
        <div className="memory-search-relaxations">
          {flow.relaxationSuggestions.slice(0, 3).map((suggestion) => <button type="button" key={`${suggestion.field}-${suggestion.value}`} onClick={() => void flow.relax(suggestion)}>移除“{relaxationLabel(suggestion, catalog)}” · 可找到 {suggestion.resultCount} 段</button>)}
        </div>
      </div>}

      {flow.status === 'error' && flow.items.length === 0 && <div className="memory-search-page-status is-error"><p>{flow.error}</p><button className="secondary-button" type="button" onClick={() => void flow.retry()}>重试加载</button></div>}

      {flow.items.length > 0 && <MemorySearchTimeline
        items={flow.items}
        nextCursor={flow.nextCursor}
        loading={flow.status === 'loading'}
        error={flow.status === 'error' ? flow.error : undefined}
        onLoadMore={() => void flow.loadMore()}
        onRetry={() => void flow.retry()}
        onSelect={onSelect}
      />}
    </section>
  );
}

function requestToCriteria(request?: MemorySearchRequest): MemorySearchCriteria {
  if (!request) return {};
  const { cursor: _cursor, pageSize: _pageSize, ...criteria } = request;
  return criteria;
}

function criteriaCount(criteria: MemorySearchCriteria) {
  return Number(Boolean(criteria.from || criteria.to)) + Number(Boolean(criteria.mood)) + (criteria.statusValues?.length ?? 0) + (criteria.topicIds?.length ?? 0) + (criteria.keywords?.length ?? 0);
}

function criteriaToParsed(criteria: MemorySearchCriteria, catalog: SearchCatalog): ParsedMemorySearch {
  const topicNames = new Map(catalog.topics.map((topic) => [topic.id, topic.name]));
  return {
    criteria,
    pendingKeywords: criteria.keywords ?? [],
    recognized: [
      ...(criteria.from || criteria.to ? [{ type: 'time' as const, label: '自定义时间' }] : []),
      ...(criteria.mood ? [{ type: 'mood' as const, label: criteria.mood }] : []),
      ...(criteria.statusValues ?? []).map((label) => ({ type: 'status' as const, label })),
      ...(criteria.topicIds ?? []).map((id) => ({ type: 'topic' as const, label: topicNames.get(id) ?? id })),
    ],
  };
}

function relaxationLabel(suggestion: MemorySearchRelaxation, catalog: SearchCatalog) {
  if (suggestion.field === 'topic') return catalog.topics.find((topic) => topic.id === suggestion.value)?.name ?? suggestion.value;
  if (suggestion.field === 'from') return '开始时间';
  if (suggestion.field === 'to') return '结束时间';
  return suggestion.value;
}
