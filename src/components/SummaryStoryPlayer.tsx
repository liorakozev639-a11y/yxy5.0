import { useCallback, useEffect, useRef, useState, type WheelEvent } from 'react';
import type { MemoryStorySummary } from '../domain/memory-summary';
import { SummaryStoryPage } from './SummaryStoryPage';

export type NavigationIntent = 'next' | 'previous';

type Props = {
  summary: MemoryStorySummary;
  initialPage: number;
  onProgress: (page: number, viewed: boolean) => void | Promise<void>;
  onEdit: () => void;
  onClose: () => void;
  onReflect: () => void;
};

export function SummaryStoryPlayer({ summary, initialPage, onProgress, onEdit, onClose, onReflect }: Props) {
  const [current, setCurrent] = useState(() => resolveNavigationIndex(initialPage, summary.pages.length, null));
  const touchStart = useRef<number | null>(null);
  const wheelLocked = useRef(false);
  const page = summary.pages[current];

  const navigate = useCallback((intent: NavigationIntent) => {
    setCurrent((value) => {
      const next = resolveNavigationIndex(value, summary.pages.length, intent);
      if (next !== value) void onProgress(next, next === summary.pages.length - 1);
      return next;
    });
  }, [onProgress, summary.pages.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown') navigate('next');
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') navigate('previous');
      if (event.key === 'Escape') closeStoryPlayer(current, onProgress, onClose);
    };
    globalThis.addEventListener?.('keydown', onKeyDown);
    return () => globalThis.removeEventListener?.('keydown', onKeyDown);
  }, [current, navigate, onClose, onProgress]);

  const onWheel = (event: WheelEvent<HTMLElement>) => {
    const intent = wheelNavigationIntent(event.deltaY);
    if (!intent || wheelLocked.current) return;
    event.preventDefault();
    wheelLocked.current = true;
    navigate(intent);
    globalThis.setTimeout(() => { wheelLocked.current = false; }, 360);
  };

  if (!page) return <section className="summary-story-player is-empty"><p>这份总结暂时没有可阅读的页面。</p><button onClick={onClose} type="button">返回档案馆</button></section>;
  const atLast = current === summary.pages.length - 1;
  return (
    <section
      className="summary-story-player"
      onTouchEnd={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (start === null) return;
        const intent = touchNavigationIntent(start, event.changedTouches[0]?.clientX ?? start);
        if (intent) navigate(intent);
      }}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onWheel={onWheel}
      tabIndex={0}
    >
      <header className="summary-story-toolbar">
        <button onClick={() => closeStoryPlayer(current, onProgress, onClose)} type="button">关闭</button>
        <div className="summary-story-progress" aria-label="观看进度" aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(summaryProgressPercent(current, summary.pages.length))} role="progressbar"><i style={{ width: `${summaryProgressPercent(current, summary.pages.length)}%` }} /></div>
        <button onClick={onEdit} type="button">编辑这部电影</button>
      </header>
      <SummaryStoryPage key={page.id} page={page} />
      <footer className="summary-story-controls">
        <button disabled={current === 0} onClick={() => navigate('previous')} type="button">上一页</button>
        <span>{current + 1} / {summary.pages.length}</span>
        {atLast
          ? <button onClick={() => { void onProgress(current, true); onReflect(); }} type="button">写下感言</button>
          : <button onClick={() => navigate('next')} type="button">下一页</button>}
      </footer>
    </section>
  );
}

export function resolveNavigationIndex(current: number, total: number, intent: NavigationIntent | null): number {
  if (total <= 0) return 0;
  const safe = Math.min(Math.max(Math.trunc(current) || 0, 0), total - 1);
  if (intent === 'next') return Math.min(safe + 1, total - 1);
  if (intent === 'previous') return Math.max(safe - 1, 0);
  return safe;
}

export function summaryProgressPercent(current: number, total: number): number {
  return total <= 0 ? 0 : ((resolveNavigationIndex(current, total, null) + 1) / total) * 100;
}

export function wheelNavigationIntent(deltaY: number): NavigationIntent | null {
  if (Math.abs(deltaY) < 24) return null;
  return deltaY > 0 ? 'next' : 'previous';
}

export function touchNavigationIntent(startX: number, endX: number): NavigationIntent | null {
  const distance = endX - startX;
  if (Math.abs(distance) < 40) return null;
  return distance < 0 ? 'next' : 'previous';
}

export function closeStoryPlayer(page: number, onProgress: Props['onProgress'], onClose: Props['onClose']) {
  void onProgress(page, false);
  onClose();
}
