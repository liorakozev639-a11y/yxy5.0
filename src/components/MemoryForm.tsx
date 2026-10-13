import { useEffect, useMemo, useState } from 'react';
import { readCaptureDate } from '../storage/image-metadata';
import { formatDateTime } from '../domain/date';
import type { Memory, MemoryDraft } from '../domain/memory';
import type { Topic } from '../domain/topic';

type MemoryFormProps = {
  initial?: Memory;
  customMoods: string[];
  customStatuses: string[];
  topics: Topic[];
  onAddMood: (value: string) => void;
  onAddStatus: (value: string) => void;
  onAddTopic: (value: string) => Promise<Topic>;
  onBatchSelected?: (files: File[]) => void;
  onSave: (draft: MemoryDraft) => Promise<void>;
  onCancel: () => void;
};

function toInputDateTime(value: string): string {
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MemoryForm({ initial, customMoods, customStatuses, topics, onAddMood, onAddStatus, onAddTopic, onBatchSelected, onSave, onCancel }: MemoryFormProps) {
  const [file, setFile] = useState<File>();
  const [eventAt, setEventAt] = useState(toInputDateTime(initial?.eventAt ?? new Date().toISOString()));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [mood, setMood] = useState(initial?.mood ?? '');
  const [statuses, setStatuses] = useState(initial?.statuses ?? []);
  const [topicIds, setTopicIds] = useState(initial?.topicIds ?? []);
  const [customTopic, setCustomTopic] = useState('');
  const [customMood, setCustomMood] = useState('');
  const [customStatus, setCustomStatus] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [addingTopic, setAddingTopic] = useState(false);
  const [error, setError] = useState('');
  const existingPreview = useMemo(() => initial?.imageUrl ?? (initial ? URL.createObjectURL(initial.imageBlob) : undefined), [initial]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (existingPreview) URL.revokeObjectURL(existingPreview);
  }, [previewUrl, existingPreview]);

  const imageUrl = previewUrl ?? existingPreview;
  const moods = Array.from(new Set([...['开心', '平静', '难过', '焦虑', '感动', '疲惫'], ...customMoods]));
  const allStatuses = Array.from(new Set([...['约会', '散步', '旅行', '工作', '学习', '家庭', '独处', '庆祝'], ...customStatuses]));

  async function handleFileChange(nextFile?: File) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setEventAt(toInputDateTime(await readCaptureDate(nextFile)));
    setError('');
  }

  async function handleFilesChange(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (selected.length > 1 && !initial && onBatchSelected) {
      onBatchSelected(selected);
      return;
    }
    await handleFileChange(selected[0]);
  }

  function toggleStatus(status: string) {
    setStatuses((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const imageBlob = file ?? initial?.imageBlob;
    if ((!imageBlob || imageBlob.size === 0) && !initial?.mediaId) {
      setError('先放入一张照片，再保存这段记忆');
      return;
    }
    const savedImageBlob = imageBlob ?? new Blob();
    setSaving(true);
    try {
      await onSave({
        imageBlob: savedImageBlob,
        imageName: file?.name ?? initial?.imageName ?? 'memory.jpg',
        mediaId: initial?.mediaId,
        eventAt: new Date(eventAt).toISOString(),
        title: title.trim(),
        note: note.trim(),
        mood,
        statuses,
        topicIds,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请稍后重试。');
    } finally {
      setSaving(false);
    }
  }

  function addMood() {
    const value = customMood.trim();
    if (!value) return;
    onAddMood(value);
    setMood(value);
    setCustomMood('');
  }

  function addStatus() {
    const value = customStatus.trim();
    if (!value) return;
    onAddStatus(value);
    setStatuses((current) => current.includes(value) ? current : [...current, value]);
    setCustomStatus('');
  }

  function toggleTopic(topicId: string) {
    setTopicIds((current) => current.includes(topicId) ? current.filter((item) => item !== topicId) : [...current, topicId]);
  }

  async function addTopic() {
    const value = customTopic.trim();
    if (!value || addingTopic) return;
    setAddingTopic(true);
    setError('');
    try {
      const topic = await onAddTopic(value);
      setTopicIds((current) => current.includes(topic.id) ? current : [...current, topic.id]);
      setCustomTopic('');
    } catch (topicError) {
      setError(topicError instanceof Error ? topicError.message : '主题保存失败，请稍后重试。');
    } finally {
      setAddingTopic(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-label={initial ? '编辑记忆' : '新增记忆'} className="modal form-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">{initial ? '补写这段时光' : '先留下照片'}</span>
            <h2>{initial ? '编辑记忆' : '新增一段记忆'}</h2>
          </div>
          <button aria-label="关闭" className="icon-button" onClick={onCancel} type="button">×</button>
        </div>
        <form onSubmit={submit}>
          <label className="upload-zone">
            {imageUrl ? <img alt="照片预览" className="upload-preview" src={imageUrl} /> : <span className="upload-placeholder"><span className="upload-plus">+</span><strong>选择一张照片</strong><small>照片会保存到你的本地数据库</small></span>}
            <input accept="image/*" hidden multiple={!initial} onChange={(event) => void handleFilesChange(event.target.files)} type="file" />
          </label>
          {imageUrl && <p className="helper-text">{file ? '已换上新照片，时间已按照片信息回填。' : `照片时间：${formatDateTime(initial?.eventAt ?? new Date().toISOString())}`}</p>}
          <div className="form-grid">
            <label className="field"><span>发生时间</span><input onChange={(event) => setEventAt(event.target.value)} type="datetime-local" value={eventAt} /></label>
            <label className="field"><span>标题 <em>可选</em></span><input onChange={(event) => setTitle(event.target.value)} placeholder="比如：我们第一次见面的那天" value={title} /></label>
          </div>
          <label className="field"><span>备忘录 <em>可选</em></span><textarea onChange={(event) => setNote(event.target.value)} placeholder="此刻想留下些什么？" rows={4} value={note} /></label>
          <div className="choice-section">
            <span className="field-label">今日心情</span>
            <div className="choice-row">{moods.map((item) => <button className={`choice ${mood === item ? 'is-selected' : ''}`} key={item} onClick={() => setMood(item)} type="button">{item}</button>)}</div>
            <div className="inline-add"><input onChange={(event) => setCustomMood(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addMood())} placeholder="自定义心情" value={customMood} /><button className="text-button" onClick={addMood} type="button">添加</button></div>
          </div>
          <div className="choice-section">
            <span className="field-label">当日状态 <small>可多选</small></span>
            <div className="choice-row">{allStatuses.map((item) => <button className={`choice ${statuses.includes(item) ? 'is-selected' : ''}`} key={item} onClick={() => toggleStatus(item)} type="button">{item}</button>)}</div>
            <div className="inline-add"><input onChange={(event) => setCustomStatus(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addStatus())} placeholder="自定义状态" value={customStatus} /><button className="text-button" onClick={addStatus} type="button">添加</button></div>
          </div>
          <div className="choice-section">
            <span className="field-label">当日主题 <small>可多选</small></span>
            <div className="choice-row">{topics.map((topic) => <button className={`choice ${topicIds.includes(topic.id) ? 'is-selected' : ''}`} key={topic.id} onClick={() => toggleTopic(topic.id)} type="button">{topic.name}</button>)}</div>
            <div className="inline-add"><input disabled={addingTopic} onChange={(event) => setCustomTopic(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), void addTopic())} placeholder="自定义主题" value={customTopic} /><button className="text-button" disabled={addingTopic} onClick={() => void addTopic()} type="button">{addingTopic ? '保存中…' : '添加'}</button></div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions"><button className="secondary-button" onClick={onCancel} type="button">先不保存</button><button className="primary-button" disabled={saving} type="submit">{saving ? '正在保存…' : initial ? '保存修改' : '保存这段记忆'}</button></div>
        </form>
      </section>
    </div>
  );
}
