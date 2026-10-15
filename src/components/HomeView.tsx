import type { ReactNode } from 'react';
import type { Memory } from '../domain/memory';
import { MemoryCard } from './MemoryCard';

type HomeViewProps = { memories: Memory[]; imageUrls: Record<string, string>; onOpenSearch: (initialText: string) => void; onSelect: (id: string) => void; onAdd: () => void; echoCard?: ReactNode; summaryCard?: ReactNode };

export function HomeView({ memories, imageUrls, onOpenSearch, onSelect, onAdd, echoCard, summaryCard }: HomeViewProps) {
  return (
    <>
      <section className="hero-section"><div><span className="eyebrow">PRIVATE MEMORY ARCHIVE</span><h1>把这一刻，留给<br /><span>未来的自己。</span></h1><p>先放一张照片。文字，等你想说的时候再回来。</p></div><button className="primary-button hero-button" onClick={onAdd} type="button"><span>＋</span> 留下一段记忆</button></section>
      {echoCard}
      {summaryCard}
      <section className="toolbar"><div><span className="section-kicker">所有记忆</span><strong>{memories.length} 个瞬间</strong></div><button aria-label="打开记忆寻迹" className="search-box home-search-entry" onClick={() => onOpenSearch('')} type="button"><span aria-hidden="true">⌕</span><span className="home-search-placeholder">描述想找的经历</span><strong>去寻迹</strong></button></section>
      {memories.length === 0 ? <section className="empty-state"><div className="empty-mark">✦</div><h2>还没有第一段记忆</h2><p>从一张照片开始，慢慢把生活收集起来。</p><button className="secondary-button" onClick={onAdd} type="button">上传第一张照片</button></section> : <div className="memory-grid">{memories.map((memory) => <MemoryCard imageUrl={imageUrls[memory.id]} key={memory.id} memory={memory} onClick={() => onSelect(memory.id)} />)}</div>}
    </>
  );
}
