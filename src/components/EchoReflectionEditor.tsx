import { useState } from 'react';
import type { MemoryEcho } from '../domain/memory-echo';

type EchoReflectionEditorProps = {
  echo: MemoryEcho;
  onCancel: () => void;
  onSave: (text: string) => Promise<void>;
};

export function EchoReflectionEditor({ echo, onCancel, onSave }: EchoReflectionEditorProps) {
  const [text, setText] = useState(echo.reflection?.text ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (!text.trim()) { setError('写下一点此刻的感受吧。'); return; }
    setSaving(true);
    setError('');
    try { await onSave(text.trim()); } catch { setError('保存失败，文字已为你保留，请稍后再试。'); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation"><section aria-modal="true" className="modal form-modal echo-reflection-modal" role="dialog"><div className="modal-head"><div><span className="eyebrow">WRITE TO YOUR PAST</span><h2>回声感言</h2></div><button aria-label="关闭回声感言" className="icon-button" onClick={onCancel} type="button">×</button></div><p className="policy-intro">这段话会独立保存在回声里，不会修改原来的备忘录。</p><label className="field"><span>此刻想说的话 <em>{text.length}/2000</em></span><textarea autoFocus maxLength={2000} onChange={(event) => setText(event.target.value)} rows={7} value={text} /></label>{error && <p className="error-text">{error}</p>}<div className="form-actions"><button className="secondary-button" onClick={onCancel} type="button">取消</button><button className="primary-button" disabled={saving} onClick={() => void submit()} type="button">{saving ? '保存中…' : '保存感言'}</button></div></section></div>;
}
