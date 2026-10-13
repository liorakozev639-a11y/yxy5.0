import { useState } from 'react';
import type { EchoPreference, EchoPreferenceUpdate } from '../domain/memory-echo';
import type { Topic } from '../domain/topic';
import type { Memory } from '../domain/memory';

type EchoSettingsPanelProps = {
  preference: EchoPreference;
  availableMoods: string[];
  disabledTopics: Topic[];
  excludedMemories: Memory[];
  onClose: () => void;
  onSave: (input: EchoPreferenceUpdate) => Promise<void>;
  onRestoreTopic: (topicId: string) => Promise<void>;
  onRestoreMemory: (memoryId: string) => Promise<void>;
};

export function EchoSettingsPanel({ preference, availableMoods, disabledTopics, excludedMemories, onClose, onSave, onRestoreTopic, onRestoreMemory }: EchoSettingsPanelProps) {
  const [enabled, setEnabled] = useState(preference.enabled);
  const [excludedMoods, setExcludedMoods] = useState(preference.excludedMoods);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function toggleMood(mood: string) { setExcludedMoods((current) => current.includes(mood) ? current.filter((item) => item !== mood) : [...current, mood]); }
  async function submit() {
    setSaving(true); setError('');
    try { await onSave({ enabled, excludedMoods }); } catch { setError('设置保存失败，请稍后重试。'); setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation"><section aria-modal="true" className="modal form-modal echo-settings-modal" role="dialog"><div className="modal-head"><div><span className="eyebrow">YOUR ECHO, YOUR RULES</span><h2>回声设置</h2></div><button aria-label="关闭回声设置" className="icon-button" onClick={onClose} type="button">×</button></div><label className="echo-switch"><span><strong>记忆回声总开关</strong><small>关闭后不会生成新的每日回声，历史记录仍会保留。</small></span><input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" /></label><fieldset className="echo-mood-settings"><legend>排除心情</legend><p>被勾选心情的记忆不会出现在新的回声中。</p><div className="choice-row">{availableMoods.map((mood) => <label className={`choice ${excludedMoods.includes(mood) ? 'is-selected' : ''}`} key={mood}><input checked={excludedMoods.includes(mood)} onChange={() => toggleMood(mood)} type="checkbox" />{mood}</label>)}</div></fieldset>{disabledTopics.length > 0 && <section className="echo-disabled-topics"><h3>已关闭的主题</h3>{disabledTopics.map((topic) => <div key={topic.id}><span>{topic.name}</span><button className="text-button" onClick={() => void onRestoreTopic(topic.id)} type="button">恢复回声</button></div>)}</section>}{excludedMemories.length > 0 && <section className="echo-disabled-topics"><h3>已排除的记忆</h3>{excludedMemories.map((memory) => <div key={memory.id}><span>{memory.title || memory.imageName}</span><button className="text-button" onClick={() => void onRestoreMemory(memory.id)} type="button">恢复回声</button></div>)}</section>}{error && <p className="error-text">{error}</p>}<div className="form-actions"><button className="secondary-button" onClick={onClose} type="button">取消</button><button className="primary-button" disabled={saving} onClick={() => void submit()} type="button">{saving ? '保存中…' : '保存设置'}</button></div></section></div>;
}
