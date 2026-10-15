import type { FormEvent } from 'react';
import type { MemorySearchCriteria, SearchCatalog } from '../domain/memory-search';

export function MemorySearchFilters({ value, catalog, onChange }: {
  value: MemorySearchCriteria;
  catalog: SearchCatalog;
  onChange(value: MemorySearchCriteria): void;
}) {
  function submitKeyword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem('keyword') as HTMLInputElement | null;
    const keyword = input?.value ?? '';
    const keywords = addSearchKeyword(value.keywords, keyword);
    if (keywords === value.keywords) return;
    onChange({ ...value, keywords });
    event.currentTarget.reset();
  }

  return (
    <section className="memory-search-filters" aria-label="高级筛选">
      <header>
        <div>
          <span className="section-kicker">ADVANCED FILTERS</span>
          <h2>按条件慢慢找</h2>
        </div>
        <button className="text-button" type="button" onClick={() => onChange({})}>清除筛选</button>
      </header>

      <div className="memory-search-date-grid">
        <label>开始日期<input type="date" value={value.from ? shanghaiDateValue(value.from) : ''} onChange={(event) => onChange({ ...value, from: event.target.value ? shanghaiDayBoundary(event.target.value, 0) : undefined })} /></label>
        <label>结束日期（含）<input type="date" value={value.to ? shanghaiDateValue(value.to, true) : ''} onChange={(event) => onChange({ ...value, to: event.target.value ? shanghaiDayBoundary(event.target.value, 1) : undefined })} /></label>
      </div>

      <FilterGroup title="心情（单选）">
        {catalog.moods.map((mood) => <Choice key={mood} selected={value.mood === mood} onClick={() => onChange({ ...value, mood: value.mood === mood ? undefined : mood })}>{mood}</Choice>)}
      </FilterGroup>
      <FilterGroup title="状态（可多选）">
        {catalog.statuses.map((status) => <Choice key={status} selected={value.statusValues?.includes(status) ?? false} onClick={() => onChange({ ...value, statusValues: toggle(value.statusValues, status) })}>{status}</Choice>)}
      </FilterGroup>
      <FilterGroup title="主题（可多选）">
        {catalog.topics.map((topic) => <Choice key={topic.id} selected={value.topicIds?.includes(topic.id) ?? false} onClick={() => onChange({ ...value, topicIds: toggle(value.topicIds, topic.id) })}>{topic.name}</Choice>)}
      </FilterGroup>

      <fieldset className="memory-search-filter-group memory-search-keywords">
        <legend>关键词（全部都要匹配）</legend>
        <form className="memory-search-keyword-form" onSubmit={submitKeyword}>
          <input aria-label="添加关键词" name="keyword" maxLength={100} placeholder="例如：海边" />
          <button className="secondary-button" type="submit" disabled={(value.keywords?.length ?? 0) >= 5}>添加</button>
        </form>
        <div className="memory-search-keyword-list">
          {(value.keywords ?? []).map((item) => <button type="button" key={item} aria-label={`删除关键词：${item}`} onClick={() => onChange({ ...value, keywords: removeSearchKeyword(value.keywords, item) })}>{item}<span aria-hidden="true">×</span></button>)}
        </div>
      </fieldset>

      <label className="memory-search-sort">排序方式
        <select value={value.sort ?? (value.keywords?.length ? 'RELEVANCE' : 'NEWEST')} onChange={(event) => onChange({ ...value, sort: event.target.value as MemorySearchCriteria['sort'] })}>
          <option value="RELEVANCE">最相关</option>
          <option value="NEWEST">时间从新到旧</option>
          <option value="OLDEST">时间从旧到新</option>
        </select>
      </label>
    </section>
  );
}

export function addSearchKeyword(values: string[] | undefined, value: string) {
  const current = values ?? [];
  const keyword = value.trim();
  if (!keyword || current.includes(keyword) || current.length >= 5) return current;
  if (current.reduce((total, item) => total + item.length, 0) + keyword.length > 100) return current;
  return [...current, keyword];
}

export function removeSearchKeyword(values: string[] | undefined, value: string) {
  return (values ?? []).filter((item) => item !== value);
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="memory-search-filter-group"><legend>{title}</legend><div>{children}</div></fieldset>;
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick(): void; children: string }) {
  return <button type="button" aria-pressed={selected} className={`choice${selected ? ' is-selected' : ''}`} onClick={onClick}>{children}</button>;
}

function toggle(values: string[] | undefined, value: string) {
  const current = values ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function shanghaiDayBoundary(date: string, dayOffset: number) {
  const instant = new Date(`${date}T00:00:00+08:00`);
  instant.setUTCDate(instant.getUTCDate() + dayOffset);
  return instant.toISOString();
}

function shanghaiDateValue(value: string, exclusiveEnd = false) {
  const instant = new Date(value);
  if (exclusiveEnd) instant.setMilliseconds(instant.getMilliseconds() - 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}
