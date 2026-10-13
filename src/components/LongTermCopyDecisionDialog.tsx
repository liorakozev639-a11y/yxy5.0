import { useState } from 'react';
import type { CopyDecisionCandidate } from '../domain/long-term-copy-policy';

export type CopyDecisionAction = 'enable' | 'skip' | 'suppress';
export type CopyDecisionMap = Record<string, CopyDecisionAction | undefined>;

type Props = {
  candidates: CopyDecisionCandidate[];
  onCancel: () => void;
  onConfirm: (decisions: CopyDecisionMap) => Promise<void>;
};

export function areCopyDecisionsComplete(candidates: CopyDecisionCandidate[], decisions: CopyDecisionMap) {
  return candidates.every(({ topic }) => Boolean(decisions[topic.id]));
}

export function LongTermCopyDecisionDialog({ candidates, onCancel, onConfirm }: Props) {
  const [decisions, setDecisions] = useState<CopyDecisionMap>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function choose(topicId: string, action: CopyDecisionAction) {
    setDecisions((current) => ({ ...current, [topicId]: action }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!areCopyDecisionsComplete(candidates, decisions)) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm(decisions);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '设置长期副本失败，请稍后重试。');
      setSaving(false);
    }
  }

  return <div className="modal-backdrop policy-backdrop" role="presentation">
    <section aria-label="长期副本设置" className="modal policy-modal">
      <div className="modal-head"><div><span className="eyebrow">LONG-TERM COPY</span><h2>把这些照片加入长期副本吗？</h2></div></div>
      <p className="policy-intro">确认后，相同主题的新照片会自动进入对应的长期副本。你可以分别决定每个主题。</p>
      <form onSubmit={(event) => void submit(event)}>
        <div className="policy-list">{candidates.map(({ topic, copy }) => <fieldset className="policy-card" key={topic.id}>
          <legend>{topic.name}</legend>
          <label><input checked={decisions[topic.id] === 'enable'} name={`policy-${topic.id}`} onChange={() => choose(topic.id, 'enable')} type="radio" />{copy ? '加入当前照片，并开启自动收录' : '创建长期副本，并开启自动收录'}</label>
          <label><input checked={decisions[topic.id] === 'skip'} name={`policy-${topic.id}`} onChange={() => choose(topic.id, 'skip')} type="radio" />这次先不加入，下次继续询问</label>
          <label><input checked={decisions[topic.id] === 'suppress'} name={`policy-${topic.id}`} onChange={() => choose(topic.id, 'suppress')} type="radio" />以后不再询问此主题</label>
        </fieldset>)}</div>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={onCancel} type="button">返回编辑</button><button className="primary-button" disabled={saving || !areCopyDecisionsComplete(candidates, decisions)} type="submit">{saving ? '正在设置…' : '确认并继续保存'}</button></div>
      </form>
    </section>
  </div>;
}
