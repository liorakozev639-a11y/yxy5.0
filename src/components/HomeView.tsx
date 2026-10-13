import { useMemo, type ReactNode } from 'react';
import { searchMemories, type Memory } from '../domain/memory';
import { MemoryCard } from './MemoryCard';

type HomeViewProps = { memories: Memory[]; imageUrls: Record<string, string>; query: string; onQueryChange: (value: string) => void; onSelect: (id: string) => void; onAdd: () => void; echoCard?: ReactNode };

export function HomeView({ memories, imageUrls, query, onQueryChange, onSelect, onAdd, echoCard }: HomeViewProps) {
  const filtered = useMemo(() => searchMemories(memories, query), [memories, query]);
  return (
    <>
      <section className="hero-section"><div><span className="eyebrow">PRIVATE MEMORY ARCHIVE</span><h1>把这一刻，留给<br /><span>未来的自己。</span></h1><p>先放一张照片。文字，等你想说的时候再回来。</p></div><button className="primary-button hero-button" onClick={onAdd} type="button"><span>＋</span> 留下一段记忆</button></section>
      {echoCard}
      <section className="toolbar"><div><span className="section-kicker">所有记忆</span><strong>{memories.length} 个瞬间</strong></div><label className="search-box"><span>⌕</span><input onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索标题、文字或标签" value={query} /></label></section>
      {filtered.length === 0 ? <section className="empty-state"><div className="empty-mark">✦</div><h2>{query ? '没有找到这段记忆' : '还没有第一段记忆'}</h2><p>{query ? '换个词试试看，或回到所有记忆。' : '从一张照片开始，慢慢把生活收集起来。'}</p>{!query && <button className="secondary-button" onClick={onAdd} type="button">上传第一张照片</button>}</section> : <div className="memory-grid">{filtered.map((memory) => <MemoryCard imageUrl={imageUrls[memory.id]} key={memory.id} memory={memory} onClick={() => onSelect(memory.id)} />)}</div>}
    </>
  );
}
