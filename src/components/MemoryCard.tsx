import { formatDateTime } from '../domain/date';
import type { Memory } from '../domain/memory';

type MemoryCardProps = {
  memory: Memory;
  imageUrl: string;
  onClick: () => void;
};

export function MemoryCard({ memory, imageUrl, onClick }: MemoryCardProps) {
  return (
    <button className="memory-card" onClick={onClick} type="button">
      <div className="card-image-wrap">
        <img alt={memory.title || memory.imageName} className="card-image" src={imageUrl} />
      </div>
      <div className="card-copy">
        <span className="eyebrow">{formatDateTime(memory.eventAt)}</span>
        <strong>{memory.title || '一段还没有命名的记忆'}</strong>
        {memory.note && <p>{memory.note}</p>}
        <div className="tag-row">
          {memory.mood && <span className="tag mood-tag">{memory.mood}</span>}
          {memory.statuses.map((status) => <span className="tag" key={status}>{status}</span>)}
          {(memory.topics ?? []).map((topic) => <span className="tag topic-tag" key={topic.id}>{topic.name}</span>)}
        </div>
      </div>
    </button>
  );
}
