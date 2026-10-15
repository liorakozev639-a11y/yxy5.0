import { useEffect, useMemo, useRef } from 'react';
import type { MemorySearchItem } from '../domain/memory-search';
import { MemoryCard } from './MemoryCard';

const MISSING_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"%3E%3Crect width="640" height="480" fill="%23e7e5de"/%3E%3Cpath d="M220 300l70-76 48 44 45-50 57 82z" fill="%23c8d2cc"/%3E%3Ccircle cx="246" cy="179" r="25" fill="%23bdcbc5"/%3E%3C/svg%3E';

export function MemorySearchTimeline({
  items,
  nextCursor,
  loading,
  error,
  onLoadMore,
  onRetry,
  onSelect,
}: {
  items: MemorySearchItem[];
  nextCursor?: string;
  loading: boolean;
  error?: string;
  onLoadMore(): void;
  onRetry(): void;
  onSelect(id: string): void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const uniqueItems = useMemo(() => deduplicate(items), [items]);
  const groups = useMemo(() => groupByShanghaiMonth(uniqueItems), [uniqueItems]);

  useEffect(() => {
    if (!nextCursor || loading || !sentinel.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
    }, { rootMargin: '240px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loading, nextCursor, onLoadMore]);

  return (
    <section className="memory-search-timeline" aria-label="寻迹结果时间流">
      {groups.map((group) => (
        <section className="memory-search-month" key={group.key}>
          <header><span>{group.label}</span><small>{group.items.length} 段记忆</small></header>
          <div className="memory-search-month-grid">
            {group.items.map((memory) => (
              <article className={`memory-search-result${memory.imageUrl ? '' : ' is-image-missing'}`} key={memory.id} id={`memory-search-${memory.id}`}>
                <MemoryCard memory={memory} imageUrl={memory.imageUrl || MISSING_IMAGE} fallbackImageUrl={MISSING_IMAGE} onImageError={(image) => image.closest('.memory-search-result')?.classList.add('is-image-missing')} onClick={() => onSelect(memory.id)} />
                <span className="memory-search-missing-image" aria-live="polite">照片暂时无法显示</span>
                {memory.longTermCopies?.length ? <div className="memory-search-copy-links" aria-label="关联长期副本">
                  {memory.longTermCopies.map((copy) => <span key={copy.id}>来自「{copy.name}」</span>)}
                </div> : null}
              </article>
            ))}
          </div>
        </section>
      ))}

      {loading && items.length > 0 && <p className="memory-search-loading">正在继续寻找下一批记忆…</p>}
      {error && <div className="memory-search-inline-error"><span>{error}</span><button className="secondary-button" type="button" onClick={onRetry}>重试加载</button></div>}
      <div ref={sentinel} className="memory-search-sentinel" aria-hidden="true" />
      <div className="memory-search-timeline-actions">
        {nextCursor && <button className="secondary-button" type="button" disabled={loading} onClick={onLoadMore}>{loading ? '正在加载…' : '继续加载 5 条'}</button>}
        <button className="text-button" type="button" onClick={() => globalThis.scrollTo?.({ top: 0, behavior: 'smooth' })}>回到顶部</button>
      </div>
    </section>
  );
}

function deduplicate(items: MemorySearchItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function groupByShanghaiMonth(items: MemorySearchItem[]) {
  const formatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long' });
  const groups = new Map<string, { key: string; label: string; items: MemorySearchItem[] }>();
  for (const item of items) {
    const date = new Date(item.eventAt);
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value ?? '';
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const key = `${year}-${month}`;
    const group = groups.get(key) ?? { key, label: formatter.format(date), items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}
