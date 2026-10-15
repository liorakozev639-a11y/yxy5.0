import type { FormEvent } from 'react';
import type { ValidatedMemorySearchHistoryEntry } from '../storage/memory-search-history';

export function MemorySearchInput({
  value,
  recentSearches,
  onChange,
  onParse,
  onUseHistory,
  onRemoveHistory,
  onClearHistory,
}: {
  value: string;
  recentSearches: ValidatedMemorySearchHistoryEntry[];
  onChange(value: string): void;
  onParse(value: string): void;
  onUseHistory(entry: ValidatedMemorySearchHistoryEntry): void;
  onRemoveHistory(id: string): void;
  onClearHistory(): void;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onParse(value);
  }

  return (
    <section className="memory-search-entry" aria-labelledby="memory-search-label">
      <form className="memory-search-form" onSubmit={submit}>
        <label id="memory-search-label" htmlFor="memory-search-input">描述你想找的经历</label>
        <div className="memory-search-field">
          <input
            id="memory-search-input"
            value={value}
            maxLength={100}
            onChange={(event) => onChange(event.target.value)}
            placeholder="例如：找上个月恋爱时开心的海边记录"
          />
          <button className="primary-button" type="submit">解析条件</button>
        </div>
        <p>支持今天、昨天、本周、上周、这个月、上个月、今年、去年、最近30天或明确日期。</p>
      </form>

      {recentSearches.length > 0 && (
        <div className="memory-search-history">
          <header>
            <strong>最近搜索</strong>
            <button className="text-button" type="button" onClick={onClearHistory}>清空最近搜索</button>
          </header>
          <div className="memory-search-history-list">
            {recentSearches.slice(0, 20).map((entry) => {
              const invalid = entry.invalidMood || entry.invalidStatusValues.length > 0 || entry.invalidTopicIds.length > 0;
              return (
                <article className="memory-search-history-item" key={entry.id}>
                  <button type="button" onClick={() => onUseHistory(entry)}>
                    <span>{entry.displayText}</span>
                    {invalid && <small>部分标签已失效，请确认后再寻迹</small>}
                  </button>
                  <button className="memory-search-history-remove" type="button" aria-label={`删除搜索：${entry.displayText}`} onClick={() => onRemoveHistory(entry.id)}>×</button>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
