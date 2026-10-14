import type { MemorySummary, StoryPeriodType, SummaryListItem, SummaryPeriod, SummaryRank, SummaryReflection } from '../domain/memory-summary';
import { SummaryArchivePage } from './SummaryArchivePage';

type Props = {
  summary?: MemorySummary;
  period: SummaryPeriod;
  date: string;
  loading?: boolean;
  error?: string;
  onPeriodChange: (period: SummaryPeriod) => void;
  onDateChange: (date: string) => void;
  onBack: () => void;
  onOpenMemory?: (id: string) => void;
  archive?: {
    summaries: SummaryListItem[];
    reflections: SummaryReflection[];
    filter: StoryPeriodType;
    onFilterChange: (filter: StoryPeriodType) => void;
    onOpen: (summaryId: string) => void;
  };
};

export function MemorySummaryPage({ summary, period, date, loading, error, onPeriodChange, onDateChange, onBack, onOpenMemory, archive }: Props) {
  if (archive) return <SummaryArchivePage {...archive} onBack={onBack} />;
  const empty = summary && summary.memoryCount === 0;
  return (
    <section className="page-section summary-page">
      <div className="page-heading summary-heading">
        <div><button className="back-button" onClick={onBack} type="button">← 返回记忆</button><span className="eyebrow">YOUR TIME, GENTLY COLLECTED</span><h1>记忆总结</h1><p>只根据你真实保存的照片和文字，回看这一段生活。</p></div>
        <div className="summary-controls">
          <div className="summary-period-switch"><button className={period === 'month' ? 'active' : ''} onClick={() => onPeriodChange('month')} type="button">月度总结</button><button className={period === 'year' ? 'active' : ''} onClick={() => onPeriodChange('year')} type="button">年度总结</button></div>
          <input aria-label="总结日期" max={period === 'year' ? '9999' : undefined} min={period === 'year' ? '1900' : undefined} onChange={(event) => onDateChange(period === 'month' ? `${event.target.value}-01` : `${event.target.value}-01-01`)} type={period === 'month' ? 'month' : 'number'} value={period === 'month' ? date.slice(0, 7) : date.slice(0, 4)} />
        </div>
      </div>
      {loading && <div className="summary-status">正在整理这段时间的记忆…</div>}
      {error && <div className="summary-status is-error">{error}</div>}
      {empty && <div className="empty-state"><div className="empty-mark">◷</div><h2>{period === 'month' ? '这个月还没有记忆' : '这一年还没有记忆'}</h2><p>等你留下第一张照片，这里会诚实地记录它。</p></div>}
      {summary && !empty && <>
        <div className="summary-title"><span>{summary.period === 'month' ? 'MONTHLY MEMORY' : 'YEARLY MEMORY'}</span><h2>{summary.label}</h2></div>
        <div className="summary-metrics"><Metric label="照片" value={summary.photoCount} /><Metric label="记忆" value={summary.memoryCount} /><Metric label="有记录的日子" value={summary.recordedDays} /></div>
        <div className="summary-grid"><RankPanel label="常出现的主题" values={summary.topTopics} /><RankPanel label="这一段的心情" values={summary.topMoods} /><RankPanel label="做过的事情" values={summary.topStatuses} /></div>
        <section className="summary-section"><div className="summary-section-title"><span>REPRESENTATIVE MOMENTS</span><h2>代表记忆</h2></div><div className="summary-memory-grid">{summary.representativeMemories.map((memory) => <button className="summary-memory" key={memory.id} onClick={() => onOpenMemory?.(memory.id)} type="button"><img alt={memory.title || '代表记忆'} src={memory.imageUrl} /><span>{new Date(memory.eventAt).toLocaleDateString('zh-CN')}</span><strong>{memory.title || '未命名的瞬间'}</strong><p>{memory.note}</p></button>)}</div></section>
        <section className="summary-section"><div className="summary-section-title"><span>LONG-TERM STORIES</span><h2>长期副本进展</h2></div>{summary.longTermCopies.length ? <div className="summary-copy-list">{summary.longTermCopies.map((copy) => <div key={copy.id}><strong>{copy.name}</strong><span>{copy.memoryCount} 段记忆</span></div>)}</div> : <p className="summary-muted">这段时间还没有关联到长期副本。</p>}</section>
      </>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function RankPanel({ label, values }: { label: string; values: SummaryRank[] }) {
  return <div className="summary-rank"><h3>{label}</h3>{values.length ? <ol>{values.map((item) => <li key={item.name}><span>{item.name}</span><strong>{item.count}</strong></li>)}</ol> : <p>暂无记录</p>}</div>;
}
