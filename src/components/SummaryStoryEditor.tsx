import { useMemo, useState } from 'react';
import type { MemoryStorySummary, SummaryStoryPage } from '../domain/memory-summary';

type PageUpdate = { version: number; narration?: string; payload?: Record<string, unknown>; displayOrder?: number };

type Props = {
  summary: MemoryStorySummary;
  onSavePage: (pageId: string, input: PageUpdate) => Promise<SummaryStoryPage>;
  onReorder: (pageId: string, displayOrder: number, version: number) => Promise<SummaryStoryPage>;
  onRegenerate: () => Promise<void>;
  onClose: () => void;
};

export function SummaryStoryEditor({ summary, onSavePage, onReorder, onRegenerate, onClose }: Props) {
  const [selectedId, setSelectedId] = useState(summary.pages[0]?.id ?? '');
  const selected = summary.pages.find((page) => page.id === selectedId) ?? summary.pages[0];
  const [narration, setNarration] = useState(selected?.narration ?? '');
  const [photoId, setPhotoId] = useState(() => selected ? stringValue(selected.payload.selectedMediaId) : '');
  const [order, setOrder] = useState(selected?.displayOrder ?? 0);
  const [message, setMessage] = useState('');
  const photos = useMemo(() => collectPhotos(summary), [summary]);

  const choosePage = (pageId: string) => {
    const page = summary.pages.find((item) => item.id === pageId);
    if (!page) return;
    setSelectedId(page.id);
    setNarration(page.narration);
    setPhotoId(stringValue(page.payload.selectedMediaId));
    setOrder(page.displayOrder);
    setMessage('');
  };

  const save = async () => {
    if (!selected) return;
    setMessage('');
    try {
      let saved = await onSavePage(selected.id, {
        version: selected.version,
        narration,
        payload: { ...selected.payload, ...(photoId ? { selectedMediaId: photoId } : {}) },
      });
      if (order !== selected.displayOrder) saved = await onReorder(selected.id, order, saved.version);
      setMessage('这一页已保存');
    } catch (error) {
      setMessage(isSummaryVersionConflict(error) ? '这份总结已在别处更新，请重新加载后再编辑。' : error instanceof Error ? error.message : '保存失败，请稍后重试');
    }
  };

  return (
    <section className="summary-story-editor">
      <header><div><span className="eyebrow">EDIT YOUR FILM</span><h1>编辑情绪电影</h1></div><button onClick={onClose} type="button">关闭编辑</button></header>
      {!selected ? <p>这份总结没有可编辑页面。</p> : <div className="summary-editor-layout">
        <nav aria-label="选择页面">{summary.pages.map((page) => <button className={page.id === selected.id ? 'active' : ''} key={page.id} onClick={() => choosePage(page.id)} type="button">第 {page.displayOrder + 1} 页 · {pageLabel(page.pageType)}</button>)}</nav>
        <div className="summary-editor-form">
          <label>编辑旁白<textarea maxLength={4000} onChange={(event) => setNarration(event.target.value)} value={narration} /></label>
          <label>替换代表照片<select onChange={(event) => setPhotoId(event.target.value)} value={photoId}><option value="">保留当前照片</option>{photos.map((photo) => <option key={photo.mediaId} value={photo.mediaId}>{photo.title || photo.mediaId}</option>)}</select></label>
          <label>页面顺序<input max={Math.max(summary.pages.length - 1, 0)} min={0} onChange={(event) => setOrder(Number(event.target.value))} type="number" value={order} /></label>
          {message && <p className={message.includes('重新加载') ? 'is-error' : ''} role="status">{message}</p>}
          <button className="primary-button" onClick={() => void save()} type="button">保存这一页</button>
        </div>
      </div>}
      <footer className="summary-editor-danger"><div><strong>重新生成</strong><p>重新读取当前原始记忆并替换所有生成页面，已经写下的感言会保留。</p></div><button onClick={() => { if (globalThis.confirm?.('重新生成会替换当前页面，确定继续吗？')) void onRegenerate(); }} type="button">重新生成</button></footer>
    </section>
  );
}

export function isSummaryVersionConflict(error: unknown) {
  return Boolean(error && typeof error === 'object' && (error as { status?: number }).status === 409);
}

function collectPhotos(summary: MemoryStorySummary) {
  const map = new Map<string, { mediaId: string; title: string }>();
  summary.pages.forEach((page) => {
    const memories = Array.isArray(page.payload.memories) ? page.payload.memories : [];
    memories.forEach((value) => {
      if (!value || typeof value !== 'object') return;
      const memory = value as Record<string, unknown>;
      const mediaId = stringValue(memory.mediaId);
      if (mediaId) map.set(mediaId, { mediaId, title: stringValue(memory.title) });
    });
  });
  return [...map.values()];
}

function stringValue(value: unknown) { return typeof value === 'string' ? value : ''; }
function pageLabel(type: SummaryStoryPage['pageType']) { return ({ COVER: '封面', OVERVIEW: '概览', MOOD: '情绪', MEMORY: '记忆', COPY: '长期副本', SEASON: '季节', QUOTE: '原文', ORDINARY: '日常', KEYWORD: '关键词', CLOSING: '结尾', REFLECTION: '感言' } as const)[type]; }
