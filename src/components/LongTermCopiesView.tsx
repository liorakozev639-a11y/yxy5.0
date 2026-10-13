import React from 'react';
import type { Topic } from '../domain/topic';
import { LongTermCopyForm } from './LongTermCopyForm';
import type { LongTermCopy, LongTermCopyInput } from '../repositories/api-long-term-copy-repository';

type Props = { copies: LongTermCopy[]; topics: Topic[]; onCreate: (input: LongTermCopyInput) => Promise<void>; onSelect: (id: string) => void; onToggleAutoCollect: (copy: LongTermCopy, enabled: boolean) => Promise<void> };

export function LongTermCopiesView({ copies, topics, onCreate, onSelect, onToggleAutoCollect }: Props) {
  const [showForm, setShowForm] = React.useState(false);
  return <section className="page-section">
    <div className="page-heading"><div><span className="eyebrow">LONG MEMORY RIVER</span><h1>长期副本</h1><p>把同一个主题的许多时刻，串成一条可以回看的时间长河。</p></div><button className="secondary-button" onClick={() => setShowForm((value) => !value)} type="button">{showForm ? '收起' : '＋ 创建长期副本'}</button></div>
    {showForm && <LongTermCopyForm onCancel={() => setShowForm(false)} onSubmit={async (input) => { await onCreate(input); setShowForm(false); }} topics={topics} />}
    {copies.length === 0 ? <div className="empty-state"><div className="empty-mark">◌</div><h2>暂无长期副本</h2><p>你可以为考研、恋爱或任何想长期记录的主题创建一条时间长河。</p><button className="secondary-button" onClick={() => setShowForm(true)} type="button">创建第一条长期副本</button></div> : <div className="copy-grid">{copies.map((copy) => <article className="copy-card" key={copy.id}><button className="copy-card-main" onClick={() => onSelect(copy.id)} type="button"><span className="eyebrow">{copy.lifecycleStatus === 'ACTIVE' ? '进行中' : copy.lifecycleStatus === 'PAUSED' ? '暂停' : copy.lifecycleStatus === 'COMPLETED' ? '已完成' : '已归档'}</span><h2>{copy.name}</h2><p>{copy.topic?.name ?? '主题时间线'} · 从 {copy.startDate.slice(0, 10)} 开始</p><span className="copy-arrow">进入时间线 →</span></button><label className="copy-auto-toggle"><input checked={copy.autoCollectEnabled} disabled={copy.lifecycleStatus !== 'ACTIVE'} onChange={(event) => void onToggleAutoCollect(copy, event.target.checked)} type="checkbox" />自动收集同主题新记忆</label></article>)}</div>}
  </section>;
}
