import { useEffect, useState } from 'react';
import { formatDateTime } from '../domain/date';
import type { ApiLongTermCopyRepository, TimelineItem } from '../repositories/api-long-term-copy-repository';

type Props = { copyId: string; repository: ApiLongTermCopyRepository; onBack: () => void };

export function LongTermCopyTimeline({ copyId, repository, onBack }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextCursor?: string) {
    setLoading(true);
    try {
      const page = await repository.timeline(copyId, { cursor: nextCursor, pageSize: 20 });
      setItems((current) => nextCursor ? [...current, ...page.items] : page.items);
      setCursor(page.nextCursor);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '时间线读取失败'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [copyId]);

  return <section className="page-section"><div className="page-heading"><div><button className="link-button" onClick={onBack} type="button">← 返回长期副本</button><span className="eyebrow">A RIVER OF DAYS</span><h1>时间长河</h1><p>照片、文字和状态会沿着发生的时间慢慢展开。</p></div></div>{error && <div className="error-banner">{error}</div>}{!loading && items.length === 0 ? <div className="empty-state"><div className="empty-mark">◷</div><h2>这条时间长河还没有记忆</h2><p>在记忆中选择对应主题，新的照片会自动流入这里。</p></div> : <div className="long-timeline">{items.map((item) => <article className="long-timeline-item" key={item.memoryId}><img alt={item.title || '时间线照片'} src={item.imageUrl} /><div><span className="eyebrow">{formatDateTime(item.eventAt)}</span>{item.title && <h3>{item.title}</h3>}{item.note && <p>{item.note}</p>}<div className="tag-row">{item.mood && <span className="tag mood-tag">{item.mood}</span>}{item.statuses.map((status) => <span className="tag" key={status}>{status}</span>)}{item.topics.map((topic) => <span className="tag topic-tag" key={topic.id}>{topic.name}</span>)}</div></div></article>)}</div>}{cursor && <button className="secondary-button" disabled={loading} onClick={() => void load(cursor)} type="button">{loading ? '正在加载…' : '继续向前看'}</button>}</section>;
}
