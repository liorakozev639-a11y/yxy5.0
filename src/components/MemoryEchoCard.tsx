import { formatDateTime } from '../domain/date';
import type { Memory } from '../domain/memory';
import type { MemoryEcho } from '../domain/memory-echo';
import type { Topic } from '../domain/topic';

type MemoryEchoCardProps = {
  echo: MemoryEcho;
  index: number;
  total: number;
  sectionLabel?: string;
  showNavigationActions?: boolean;
  onOpen: (memoryId: string) => void;
  onReflect: (echo: MemoryEcho) => void;
  onDismiss: (echo: MemoryEcho) => void;
  onNext: () => void;
  onOpenAll: () => void;
  onExclude: (memory: Memory) => void;
  onDisableTopic: (topic: Topic) => void;
};

function EchoMemory({ label, memory, onOpen }: { label?: string; memory: Memory; onOpen: (memoryId: string) => void }) {
  return (
    <article className="echo-memory">
      {label && <span className="echo-memory-label">{label}</span>}
      {memory.imageUrl ? <button className="echo-image-button" onClick={() => onOpen(memory.id)} type="button"><img alt={memory.title || memory.imageName} src={memory.imageUrl} /></button> : <div className="echo-image-placeholder">照片暂不可用</div>}
      <div className="echo-memory-copy">
        <span className="eyebrow">{formatDateTime(memory.eventAt)}</span>
        <h3>{memory.title || '这一刻，值得被记住'}</h3>
        {memory.note && <p>{memory.note}</p>}
        <div className="tag-row">
          {memory.mood && <span className="tag mood-tag">{memory.mood}</span>}
          {memory.statuses.map((status) => <span className="tag" key={status}>{status}</span>)}
          {(memory.topics ?? []).map((topic) => <span className="tag topic-tag" key={topic.id}>{topic.name}</span>)}
        </div>
      </div>
    </article>
  );
}

export function MemoryEchoCard({ echo, index, total, sectionLabel = '今日回声', showNavigationActions = true, onOpen, onReflect, onDismiss, onNext, onOpenAll, onExclude, onDisableTopic }: MemoryEchoCardProps) {
  const memory = echo.memory;
  const topic = echo.sourceTopic;
  return (
    <section className="echo-card" data-echo-id={echo.id}>
      <div className="echo-card-head">
        <div><span className="section-kicker">{sectionLabel}</span><h2>{echo.reason}</h2></div>
        <span className="echo-position">{Math.min(index + 1, total || 1)} / {total || 1}</span>
      </div>
      {!echo.memoryAvailable || !memory ? <div className="echo-unavailable"><strong>原记忆已不可用</strong><p>这条回声还在，但原照片或文字已经不存在。</p></div> : echo.type === 'PAST_AND_NOW' && echo.comparisonMemoryAvailable && echo.comparisonMemory ? <div className="echo-comparison"><EchoMemory label="那时" memory={echo.comparisonMemory} onOpen={onOpen} /><EchoMemory label="现在" memory={memory} onOpen={onOpen} /></div> : <EchoMemory memory={memory} onOpen={onOpen} />}
      {echo.reflection && <blockquote className="echo-reflection">“{echo.reflection.text}”</blockquote>}
      <div className="echo-primary-actions">
        <button className="primary-button" onClick={() => onReflect(echo)} type="button">写下感言</button>
        {showNavigationActions && total > 1 && <button className="secondary-button" onClick={onNext} type="button">换一条</button>}
        {showNavigationActions && <button className="text-button" onClick={onOpenAll} type="button">查看全部</button>}
      </div>
      <details className="echo-more-actions">
        <summary>更多控制</summary>
        <div>
          <button className="text-button" onClick={() => onDismiss(echo)} type="button">暂时跳过</button>
          {memory && <button className="text-button" onClick={() => onExclude(memory)} type="button">不再回声这段记忆</button>}
          {topic && <button className="text-button" onClick={() => onDisableTopic(topic)} type="button">关闭“{topic.name}”主题回声</button>}
        </div>
      </details>
    </section>
  );
}
