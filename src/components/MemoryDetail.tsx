import { formatDateTime } from '../domain/date';
import type { Memory } from '../domain/memory';
import type { EchoReflection } from '../domain/memory-echo';

type MemoryDetailProps = { memory: Memory; imageUrl: string; onEdit: () => void; onDelete: () => void; onClose: () => void; reflections?: EchoReflection[] };

export function MemoryDetail({ memory, imageUrl, onEdit, onDelete, onClose, reflections = [] }: MemoryDetailProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal detail-modal">
        <button aria-label="关闭详情" className="detail-close icon-button" onClick={onClose} type="button">×</button>
        <div className="detail-image-wrap"><img alt={memory.title || memory.imageName} className="detail-image" src={imageUrl} /></div>
        <div className="detail-copy">
          <span className="eyebrow">{formatDateTime(memory.eventAt)}</span>
          <h2>{memory.title || '这一刻，值得被记住'}</h2>
          {memory.note ? <p className="detail-note">{memory.note}</p> : <p className="detail-empty">还没有写下备忘录，给未来的自己留一句话吧。</p>}
          <div className="tag-row detail-tags">{memory.mood && <span className="tag mood-tag">{memory.mood}</span>}{memory.statuses.map((status) => <span className="tag" key={status}>{status}</span>)}{(memory.topics ?? []).map((topic) => <span className="tag topic-tag" key={topic.id}>{topic.name}</span>)}</div>
          {reflections.length > 0 && <section className="detail-reflections"><span className="section-kicker">回声感言</span>{reflections.map((reflection) => <article key={reflection.id}><time>{reflection.sourceEchoDate.slice(0, 10)}</time><p>{reflection.text}</p></article>)}</section>}
          <div className="detail-actions"><button className="secondary-button" onClick={onEdit} type="button">编辑记忆</button><button className="danger-button" onClick={onDelete} type="button">删除</button></div>
        </div>
      </section>
    </div>
  );
}
