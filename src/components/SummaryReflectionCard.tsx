import type { SummaryListItem, SummaryReflection } from '../domain/memory-summary';

type Props = {
  reflection: SummaryReflection;
  summary?: SummaryListItem;
  onOpen?: (summaryId: string) => void;
};

export function SummaryReflectionCard({ reflection, summary, onOpen }: Props) {
  const label = summary?.periodType === 'YEAR' ? '年度感言' : '月度感言';
  const period = summary ? formatPeriod(summary) : '过去的你';
  return (
    <button className="summary-reflection-card" onClick={() => onOpen?.(reflection.summaryId)} type="button">
      {reflection.coverMediaId && <img alt="感言封面" src={`/api/media/${encodeURIComponent(reflection.coverMediaId)}/file`} />}
      <span>{label} · {period}</span>
      <blockquote>{reflection.text}</blockquote>
      <small>写给未来的你</small>
    </button>
  );
}

function formatPeriod(summary: SummaryListItem) {
  if (summary.periodType === 'YEAR') return `${summary.periodKey}年`;
  const [year, month] = summary.periodKey.split('-');
  return `${year}年${Number(month)}月`;
}
