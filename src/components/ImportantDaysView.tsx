import { useState } from 'react';
import { daysFromToday, formatDay } from '../domain/date';
import { linkedMemories, toggleMemoryLink, type ImportantDay } from '../domain/important-day';
import type { Memory } from '../domain/memory';

type ImportantDaysViewProps = {
  days: ImportantDay[];
  memories: Memory[];
  imageUrls: Record<string, string>;
  onCreate: (name: string, date: string) => Promise<void>;
  onUpdate: (day: ImportantDay) => Promise<void>;
  onDelete: (day: ImportantDay) => Promise<void>;
  onSelectMemory: (id: string) => void;
};

export function ImportantDaysView({ days, memories, imageUrls, onCreate, onUpdate, onDelete, onSelectMemory }: ImportantDaysViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [managingId, setManagingId] = useState<string>();

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !date) return;
    await onCreate(name.trim(), date);
    setName('');
    setShowForm(false);
  }

  return (
    <section className="page-section">
      <div className="page-heading"><div><span className="eyebrow">MARK THE DAYS</span><h1>重要日子</h1><p>把值得每年想起的日子，先放在这里。</p></div><button className="secondary-button" onClick={() => setShowForm((value) => !value)} type="button">{showForm ? '收起' : '＋ 记录一个日子'}</button></div>
      {showForm && <form className="important-form" onSubmit={(event) => void create(event)}><label className="field"><span>日子名称</span><input autoFocus onChange={(event) => setName(event.target.value)} placeholder="比如：恋爱纪念日" value={name} /></label><label className="field"><span>日期</span><input onChange={(event) => setDate(event.target.value)} type="date" value={date} /></label><button className="primary-button" type="submit">保存这个日子</button></form>}
      {days.length === 0 ? <div className="empty-state"><div className="empty-mark">♡</div><h2>给值得纪念的日子一个位置</h2><p>创建后，可以把已有照片和故事关联进来。</p><button className="secondary-button" onClick={() => setShowForm(true)} type="button">记录第一个日子</button></div> : <div className="important-grid">{days.map((day) => { const linked = linkedMemories(day, memories); const delta = daysFromToday(day.date); return <article className="important-card" key={day.id}><div className="important-card-head"><div><span className="eyebrow">{delta > 0 ? `${delta} 天后` : delta < 0 ? `已过去 ${Math.abs(delta)} 天` : '就是今天'}</span><h2>{day.name}</h2><p>{formatDay(day.date)}</p></div><button className="icon-button" onClick={() => void onDelete(day)} type="button">×</button></div><div className="linked-strip">{linked.length ? linked.map((memory) => <button className="linked-photo" key={memory.id} onClick={() => onSelectMemory(memory.id)} type="button"><img alt={memory.title || memory.imageName} src={imageUrls[memory.id]} /></button>) : <span>还没有关联的照片</span>}</div><button className="link-button" onClick={() => setManagingId(managingId === day.id ? undefined : day.id)} type="button">{managingId === day.id ? '完成关联' : '关联已有记忆'}</button>{managingId === day.id && <div className="link-list">{memories.length ? memories.map((memory) => <label key={memory.id}><input checked={day.memoryIds.includes(memory.id)} onChange={() => void onUpdate(toggleMemoryLink(day, memory.id))} type="checkbox" />{memory.title || memory.imageName}</label>) : <span>先去记忆页保存一张照片</span>}</div>}</article>; })}</div>}
    </section>
  );
}
