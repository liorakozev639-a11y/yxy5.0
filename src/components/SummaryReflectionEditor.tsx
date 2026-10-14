import { useMemo, useState } from 'react';
import type { MemoryStorySummary, SummaryReflection } from '../domain/memory-summary';

export type ReflectionInput = { text: string; coverMediaId?: string };

type Props = {
  summary: MemoryStorySummary;
  initialText: string;
  onSave: (input: ReflectionInput) => Promise<SummaryReflection> | SummaryReflection;
  onCancel: () => void;
};

export function SummaryReflectionEditor({ summary, initialText, onSave, onCancel }: Props) {
  const [text, setText] = useState(initialText);
  const photos = useMemo(() => collectReflectionPhotos(summary), [summary]);
  const [coverMediaId, setCoverMediaId] = useState(photos[0]?.mediaId ?? '');
  const [message, setMessage] = useState('');
  const input = buildReflectionInput(text, coverMediaId);

  const save = async () => {
    if (!input) return;
    try {
      await onSave(input);
      setMessage('回声感言已保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请稍后重试');
    }
  };

  return (
    <section className="summary-reflection-editor">
      <span className="eyebrow">A NOTE TO YOUR FUTURE SELF</span>
      <h1>写给未来的你</h1>
      <p>这是总结专属的回声感言，会出现在情绪电影档案馆，不会创建一条普通图片记忆。</p>
      <label>感言<textarea maxLength={2000} onChange={(event) => setText(event.target.value)} placeholder="看完这一段生活，你想对未来的自己说什么？" value={text} /></label>
      <label>选择感言封面<select onChange={(event) => setCoverMediaId(event.target.value)} value={coverMediaId}><option value="">不使用照片</option>{photos.map((photo) => <option key={photo.mediaId} value={photo.mediaId}>{photo.title || '一张代表照片'}</option>)}</select></label>
      {message && <p role="status">{message}</p>}
      <div className="summary-reflection-actions"><button onClick={onCancel} type="button">暂不保存</button><button className="primary-button" disabled={!input} onClick={() => void save()} type="button">保存回声感言</button></div>
    </section>
  );
}

export function buildReflectionInput(text: string, coverMediaId?: string): ReflectionInput | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return { text: trimmed, ...(coverMediaId ? { coverMediaId } : {}) };
}

function collectReflectionPhotos(summary: MemoryStorySummary) {
  const map = new Map<string, { mediaId: string; title: string }>();
  summary.pages.forEach((page) => {
    const memories = Array.isArray(page.payload.memories) ? page.payload.memories : [];
    memories.forEach((value) => {
      if (!value || typeof value !== 'object') return;
      const memory = value as Record<string, unknown>;
      const mediaId = typeof memory.mediaId === 'string' ? memory.mediaId : '';
      if (mediaId) map.set(mediaId, { mediaId, title: typeof memory.title === 'string' ? memory.title : '' });
    });
  });
  return [...map.values()];
}
