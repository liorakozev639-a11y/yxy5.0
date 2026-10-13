import { useEffect, useState } from 'react';
import type { Topic } from '../domain/topic';
import type { LifecycleStatus, LongTermCopyInput } from '../repositories/api-long-term-copy-repository';

type Props = { topics: Topic[]; onCancel: () => void; onSubmit: (input: LongTermCopyInput) => Promise<void> };

export function resolveTopicSelection(currentTopicId: string, topics: Topic[]) {
  const ordinaryTopics = topics.filter((topic) => !topic.isNone);
  return ordinaryTopics.some((topic) => topic.id === currentTopicId) ? currentTopicId : ordinaryTopics[0]?.id ?? '';
}

export function LongTermCopyForm({ topics, onCancel, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [topicId, setTopicId] = useState(topics.find((topic) => !topic.isNone)?.id ?? '');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [lifecycleStatus, setLifecycleStatus] = useState<LifecycleStatus>('ACTIVE');
  const [autoCollectEnabled, setAutoCollectEnabled] = useState(true);
  const [backfill, setBackfill] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTopicId((current) => resolveTopicSelection(current, topics));
  }, [topics]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !topicId || !startDate) return;
    setSaving(true);
    try { await onSubmit({ name: name.trim(), topicId, startDate, lifecycleStatus, autoCollectEnabled, backfill }); } finally { setSaving(false); }
  }

  return <form className="important-form copy-form" onSubmit={(event) => void submit(event)}>
    <label className="field"><span>长期副本名称</span><input autoFocus onChange={(event) => setName(event.target.value)} placeholder="比如：我的考研时光" value={name} /></label>
    <label className="field"><span>关联主题</span><select onChange={(event) => setTopicId(event.target.value)} value={topicId}>{topics.filter((topic) => !topic.isNone).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
    <div className="form-grid"><label className="field"><span>开始日期</span><input onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /></label><label className="field"><span>初始状态</span><select onChange={(event) => setLifecycleStatus(event.target.value as LifecycleStatus)} value={lifecycleStatus}><option value="ACTIVE">进行中</option><option value="PAUSED">暂停</option><option value="COMPLETED">已完成</option><option value="ARCHIVED">已归档</option></select></label></div>
    <label className="checkbox-line"><input checked={autoCollectEnabled} onChange={(event) => setAutoCollectEnabled(event.target.checked)} type="checkbox" />自动收集以后新增的同主题记忆</label>
    <label className="checkbox-line"><input checked={backfill} onChange={(event) => setBackfill(event.target.checked)} type="checkbox" />导入开始日期之后已有的同主题记忆</label>
    <div className="form-actions"><button className="secondary-button" onClick={onCancel} type="button">先不创建</button><button className="primary-button" disabled={saving} type="submit">{saving ? '正在创建…' : '创建长期副本'}</button></div>
  </form>;
}
