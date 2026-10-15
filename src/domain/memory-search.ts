import type { Memory } from './memory';

export type MemorySearchSort = 'RELEVANCE' | 'NEWEST' | 'OLDEST';
export type MemorySearchMatchMode = 'EXACT' | 'FUZZY';

export type MemorySearchCriteria = {
  from?: string;
  to?: string;
  mood?: string;
  statusValues?: string[];
  topicIds?: string[];
  keywords?: string[];
  matchMode?: MemorySearchMatchMode;
  sort?: MemorySearchSort;
};

export type MemorySearchRequest = MemorySearchCriteria & {
  cursor?: string;
  pageSize: 5;
};

export type LinkedLongTermCopy = { id: string; name: string };
export type MemorySearchItem = Memory & { longTermCopies?: LinkedLongTermCopy[] };
export type MemorySearchRelaxation = {
  field: 'from' | 'to' | 'mood' | 'status' | 'topic' | 'keyword';
  value: string;
  resultCount: number;
};
export type MemorySearchPage = {
  items: MemorySearchItem[];
  total: number;
  nextCursor?: string;
  relaxationSuggestions?: MemorySearchRelaxation[];
};

export type SearchCatalog = {
  moods: string[];
  statuses: string[];
  topics: Array<{ id: string; name: string }>;
};

export type ParsedMemorySearch = {
  criteria: MemorySearchCriteria;
  pendingKeywords: string[];
  recognized: Array<{ type: 'time' | 'mood' | 'status' | 'topic'; label: string }>;
};

export function normalizeMemorySearchCriteria(criteria: MemorySearchCriteria): MemorySearchCriteria {
  const keywords = unique(criteria.keywords);
  const statusValues = unique(criteria.statusValues);
  const topicIds = unique(criteria.topicIds);
  const mood = criteria.mood?.trim();
  const textLength = keywords.reduce((total, keyword) => total + keyword.length, 0);

  if (textLength > 100) throw new Error('搜索文字不能超过100个字符');
  if (keywords.length > 5) throw new Error('最多添加5个关键词');
  if (statusValues.length > 10) throw new Error('最多选择10个状态');
  if (topicIds.length > 10) throw new Error('最多选择10个主题');

  return {
    ...(criteria.from ? { from: criteria.from } : {}),
    ...(criteria.to ? { to: criteria.to } : {}),
    ...(mood ? { mood } : {}),
    ...(statusValues.length ? { statusValues } : {}),
    ...(topicIds.length ? { topicIds } : {}),
    ...(keywords.length ? { keywords } : {}),
    ...(criteria.sort ? { sort: criteria.sort } : {}),
    ...(criteria.matchMode ? { matchMode: criteria.matchMode } : {}),
  };
}

export function memoryMatchesExactCriteria(memory: Memory, criteria: MemorySearchCriteria): boolean {
  const normalized = normalizeMemorySearchCriteria(criteria);
  const eventAt = new Date(memory.eventAt).getTime();
  if (normalized.from && eventAt < new Date(normalized.from).getTime()) return false;
  if (normalized.to && eventAt >= new Date(normalized.to).getTime()) return false;
  if (normalized.mood && memory.mood !== normalized.mood) return false;
  if (normalized.statusValues?.some((status) => !memory.statuses.includes(status))) return false;
  const memoryTopicIds = new Set(memory.topicIds ?? memory.topics?.map((topic) => topic.id) ?? []);
  if (normalized.topicIds?.some((topicId) => !memoryTopicIds.has(topicId))) return false;
  const searchable = `${memory.title}\n${memory.note}`.toLocaleLowerCase();
  if (normalized.keywords?.some((keyword) => !searchable.includes(keyword.toLocaleLowerCase()))) return false;
  return true;
}

function unique(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}
