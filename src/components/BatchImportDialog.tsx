import { useMemo, useState } from 'react';
import type { Memory, MemoryDraft } from '../domain/memory';
import type { Topic } from '../domain/topic';
import { createBatchImportItems, failedBatchItems, resolveBatchDates, runBatchImport, type BatchImportItem } from '../domain/batch-import';

type Props = {
  files: File[];
  topics: Topic[];
  onAddTopic: (value: string) => Promise<Topic>;
  onResolvePolicy: (topicIds: string[], eventAt: string) => Promise<void>;
  onSaveDraft: (draft: MemoryDraft) => Promise<Memory>;
  onComplete: (memories: Memory[]) => void;
  onClose: () => void;
};

export function BatchImportDialog({ files, topics, onAddTopic, onResolvePolicy, onSaveDraft, onComplete, onClose }: Props) {
  const [sameTopic, setSameTopic] = useState<'yes' | 'no' | ''>('');
  const [topicId, setTopicId] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [items, setItems] = useState<BatchImportItem[]>(() => createBatchImportItems(files));
  const [phase, setPhase] = useState<'setup' | 'importing' | 'done'>('setup');
  const [error, setError] = useState('');
  const [addingTopic, setAddingTopic] = useState(false);

  const counts = useMemo(() => ({
    success: items.filter((item) => item.status === 'success').length,
    failed: items.filter((item) => item.status === 'failed').length,
    running: items.filter((item) => item.status === 'running').length,
  }), [items]);

  function updateItem(next: BatchImportItem) {
    setItems((current) => current.map((item) => item.id === next.id ? next : item));
  }

  async function addTopic() {
    const value = customTopic.trim();
    if (!value || addingTopic) return;
    setAddingTopic(true);
    setError('');
    try {
      const topic = await onAddTopic(value);
      setTopicId(topic.id);
      setCustomTopic('');
    } catch (topicError) {
      setError(topicError instanceof Error ? topicError.message : '主题创建失败');
    } finally {
      setAddingTopic(false);
    }
  }

  async function start() {
    if (!sameTopic) { setError('请选择是否设置相同主题'); return; }
    if (sameTopic === 'yes' && !topicId) { setError('请选择或创建一个主题'); return; }
    setError('');
    setPhase('importing');
    try {
      const prepared = await resolveBatchDates(items);
      setItems(prepared);
      const selectedTopicId = sameTopic === 'yes' ? topicId : undefined;
      if (selectedTopicId) {
        const earliest = prepared.map((item) => item.eventAt!).sort()[0];
        await onResolvePolicy([selectedTopicId], earliest);
      }
      const results = await runBatchImport(prepared, selectedTopicId, onSaveDraft, updateItem);
      setItems(results);
      onComplete(results.flatMap((item) => item.memory ? [item.memory] : []));
      setPhase('done');
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : '批量导入未能开始');
      setPhase('setup');
    }
  }

  async function retryFailed() {
    const failed = failedBatchItems(items);
    if (!failed.length) return;
    setPhase('importing');
    const retried = await runBatchImport(failed, sameTopic === 'yes' ? topicId : undefined, onSaveDraft, updateItem);
    const retriedById = new Map(retried.map((item) => [item.id, item]));
    setItems((current) => current.map((item) => retriedById.get(item.id) ?? item));
    onComplete(retried.flatMap((item) => item.memory ? [item.memory] : []));
    setPhase('done');
  }

  const ordinaryTopics = topics.filter((topic) => !topic.isNone);
  return <div className="modal-backdrop policy-backdrop" role="presentation">
    <section aria-label="批量导入照片" className="modal batch-modal">
      <div className="modal-head"><div><span className="eyebrow">BATCH IMPORT</span><h2>检测到你选择了 {files.length} 张照片</h2></div>{phase !== 'importing' && <button aria-label="关闭" className="icon-button" onClick={onClose} type="button">×</button>}</div>
      {phase === 'setup' ? <>
        <p className="policy-intro">是否为这批照片设置相同主题？照片会分别保存，之后仍可逐张编辑。</p>
        <div className="batch-choice"><label><input checked={sameTopic === 'yes'} onChange={() => setSameTopic('yes')} type="radio" />是，使用相同主题</label><label><input checked={sameTopic === 'no'} onChange={() => setSameTopic('no')} type="radio" />否，只保存照片和时间</label></div>
        <label className="field"><span>统一主题</span><select disabled={sameTopic !== 'yes'} onChange={(event) => setTopicId(event.target.value)} value={topicId}><option value="">请选择主题</option>{ordinaryTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
        <div className="inline-add"><input disabled={sameTopic !== 'yes' || addingTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="创建新主题" value={customTopic} /><button className="text-button" disabled={sameTopic !== 'yes' || addingTopic} onClick={() => void addTopic()} type="button">{addingTopic ? '保存中…' : '添加并选中'}</button></div>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions"><button className="secondary-button" onClick={onClose} type="button">取消</button><button className="primary-button" onClick={() => void start()} type="button">开始导入</button></div>
      </> : <>
        <div className="batch-summary"><span>总计<strong>{items.length}</strong></span><span>成功<strong>{counts.success}</strong></span><span>失败<strong>{counts.failed}</strong></span><span>处理中<strong>{counts.running}</strong></span></div>
        <div className="batch-progress"><i style={{ width: `${items.length ? ((counts.success + counts.failed) / items.length) * 100 : 0}%` }} /></div>
        <div className="batch-file-list">{items.map((item) => <div className={`batch-file is-${item.status}`} key={item.id}><span>{item.file.name}</span><small>{item.status === 'pending' ? '等待中' : item.status === 'running' ? '正在导入' : item.status === 'success' ? '已完成' : item.error ?? '导入失败'}</small></div>)}</div>
        {error && <p className="error-text">{error}</p>}
        {phase === 'done' && <div className="form-actions">{counts.failed > 0 && <button className="secondary-button" onClick={() => void retryFailed()} type="button">重试失败项</button>}<button className="primary-button" onClick={onClose} type="button">完成</button></div>}
      </>}
    </section>
  </div>;
}
