import type { ParsedMemorySearch } from '../domain/memory-search';

export function MemorySearchConfirmation({ parsed, confirmed, onConfirmChange, onStart }: {
  parsed: ParsedMemorySearch;
  confirmed: boolean;
  onConfirmChange(value: boolean): void;
  onStart(): void;
}) {
  const chips = [
    ...parsed.recognized.map((item) => ({ key: `${item.type}-${item.label}`, label: item.label, kind: item.type })),
    ...parsed.pendingKeywords.map((keyword) => ({ key: `keyword-${keyword}`, label: keyword, kind: '关键词' })),
  ];
  return (
    <section className="memory-search-confirmation" aria-labelledby="search-confirmation-title">
      <span className="section-kicker">CONFIRM BEFORE SEARCH</span>
      <h2 id="search-confirmation-title">我理解的是这些条件</h2>
      <div className="memory-search-chips">
        {chips.length ? chips.map((chip) => <span className="memory-search-chip" key={chip.key}><small>{chip.kind}</small>{chip.label}</span>) : <span className="memory-search-all">没有筛选条件，将浏览全部记忆</span>}
      </div>
      <label className="memory-search-consent">
        <input type="checkbox" checked={confirmed} onChange={(event) => onConfirmChange(event.target.checked)} />
        <span>我已确认这些条件，可以开始寻迹</span>
      </label>
      <button className="primary-button" type="button" disabled={!confirmed} onClick={onStart}>开始寻迹</button>
    </section>
  );
}
