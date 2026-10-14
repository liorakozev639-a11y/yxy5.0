import type { StoryPeriodType, SummaryListItem, SummaryReflection } from '../domain/memory-summary';
import { isReadySummary } from '../domain/memory-summary';
import { SummaryReflectionCard } from './SummaryReflectionCard';

export type SummaryArchiveProps = {
  summaries: SummaryListItem[];
  reflections: SummaryReflection[];
  filter: StoryPeriodType;
  onFilterChange: (filter: StoryPeriodType) => void;
  onOpen: (summaryId: string) => void;
  onBack: () => void;
};

export function SummaryArchivePage({ summaries, reflections, filter, onFilterChange, onOpen, onBack }: SummaryArchiveProps) {
  const visible = summaries
    .filter((summary) => summary.periodType === filter && isReadySummary(summary))
    .sort((left, right) => right.periodKey.localeCompare(left.periodKey));
  const visibleIds = new Set(visible.map((summary) => summary.id));
  const visibleReflections = reflections.filter((reflection) => visibleIds.has(reflection.summaryId));

  return (
    <section className="page-section summary-archive-page">
      <div className="page-heading summary-archive-heading">
        <div>
          <button className="back-button" onClick={onBack} type="button">← 返回记忆</button>
          <span className="eyebrow">YOUR EMOTION FILMS</span>
          <h1>情绪电影档案馆</h1>
          <p>每一份总结都是生成后保存下来的独立档案，你可以随时回来继续观看。</p>
        </div>
        <div className="summary-period-switch" role="group" aria-label="总结类型">
          <button className={filter === 'MONTH' ? 'active' : ''} onClick={() => onFilterChange('MONTH')} type="button">月度总结</button>
          <button className={filter === 'YEAR' ? 'active' : ''} onClick={() => onFilterChange('YEAR')} type="button">年度总结</button>
        </div>
      </div>

      {!visible.length && !visibleReflections.length ? (
        <div className="empty-state">
          <div className="empty-mark">◷</div>
          <h2>{filter === 'MONTH' ? '还没有月度总结' : '还没有年度总结'}</h2>
          <p>有真实记忆的周期才会出现在这里，不会为了填满页面虚构内容。</p>
        </div>
      ) : (
        <>
          <div className="summary-archive-grid">
            {visible.map((summary) => (
              <button className="summary-archive-card" data-summary-id={summary.id} key={summary.id} onClick={() => onOpen(summary.id)} type="button">
                <span className="summary-archive-kind">{summary.periodType === 'MONTH' ? 'MONTHLY FILM' : 'YEARLY FILM'}</span>
                <strong>{formatPeriod(summary)}</strong>
                <p>{summary.generationMode === 'AI' ? 'AI 在真实记录范围内整理' : '本地模板整理'} · 从第 {summary.lastViewedPage + 1} 页继续</p>
                <div className="summary-archive-badges">
                  {!summary.viewedAt && <em>未读</em>}
                  {summary.isCompact && <em>精简版</em>}
                </div>
              </button>
            ))}
          </div>
          {visibleReflections.length > 0 && (
            <section className="summary-reflection-section">
              <div className="summary-section-title"><span>WORDS TO YOUR FUTURE SELF</span><h2>回声感言</h2></div>
              <div className="summary-reflection-grid">
                {visibleReflections.map((reflection) => (
                  <SummaryReflectionCard key={reflection.id} onOpen={onOpen} reflection={reflection} summary={visible.find((summary) => summary.id === reflection.summaryId)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}

function formatPeriod(summary: SummaryListItem) {
  if (summary.periodType === 'YEAR') return `${summary.periodKey} 年度回忆`;
  const [year, month] = summary.periodKey.split('-');
  return `${year}年${Number(month)}月`;
}
