import type { MemorySearchCriteria, SearchCatalog } from '../domain/memory-search';

export function MemorySearchFilters({ value, catalog, onChange }: {
  value: MemorySearchCriteria;
  catalog: SearchCatalog;
  onChange(value: MemorySearchCriteria): void;
}) {
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

      <label className="memory-search-sort">排序方式
        <select value={value.sort ?? 'NEWEST'} onChange={(event) => onChange({ ...value, sort: event.target.value as MemorySearchCriteria['sort'] })}>
          <option value="RELEVANCE">最相关</option>
          <option value="NEWEST">时间从新到旧</option>
          <option value="OLDEST">时间从旧到新</option>
        </select>
      </label>
    </section>
  );
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
