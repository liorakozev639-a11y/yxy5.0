import { isReadySummary, type SummaryListItem } from '../domain/memory-summary';

type Props = {
  due: SummaryListItem[];
  onOpen: (summaryId: string) => void;
  onLater: () => void;
};

export function SummaryReminderCard({ due, onOpen, onLater }: Props) {
  const unread = due.filter((summary) => isReadySummary(summary) && !summary.viewedAt);
  if (!unread.length) return null;
  const hasMonth = unread.some((summary) => summary.periodType === 'MONTH');
  const hasYear = unread.some((summary) => summary.periodType === 'YEAR');
  const title = hasMonth && hasYear
    ? '你的月度总结和年度总结已经生成好了'
    : hasYear
      ? '上一年的年度总结已经生成好了'
      : '上个月的月度总结已经生成好了';
  const first = unread[0];

  return (
    <aside className="summary-reminder-card" aria-label="新总结提醒">
      <div className="summary-reminder-glow" aria-hidden="true" />
      <div>
        <span className="eyebrow">YOUR EMOTION FILM</span>
        <h2>{title}</h2>
        <p>照片、情绪和那些认真生活过的片段，已经被整理成一场只属于你的情绪电影。</p>
      </div>
      <div className="summary-reminder-actions">
        <button className="secondary-button" onClick={onLater} type="button">稍后提醒</button>
        <button className="primary-button" onClick={() => onOpen(first.id)} type="button">现在查看</button>
      </div>
    </aside>
  );
}
