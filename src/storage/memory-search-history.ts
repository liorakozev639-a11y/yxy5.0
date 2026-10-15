import { normalizeMemorySearchCriteria, type MemorySearchCriteria, type SearchCatalog } from '../domain/memory-search';

const STORAGE_KEY = 'photo-memory-search-history-v1';
const STORAGE_VERSION = 1;
const MAX_HISTORY = 20;

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type MemorySearchHistoryEntry = {
  id: string;
  displayText: string;
  criteria: MemorySearchCriteria;
  createdAt: string;
};

export type ValidatedMemorySearchHistoryEntry = MemorySearchHistoryEntry & {
  invalidMood: boolean;
  invalidStatusValues: string[];
  invalidTopicIds: string[];
};

export function sanitizeHistoryCriteria(entry: ValidatedMemorySearchHistoryEntry): MemorySearchCriteria {
  return normalizeMemorySearchCriteria({
    ...entry.criteria,
    mood: entry.invalidMood ? undefined : entry.criteria.mood,
    statusValues: entry.criteria.statusValues?.filter((value) => !entry.invalidStatusValues.includes(value)),
    topicIds: entry.criteria.topicIds?.filter((value) => !entry.invalidTopicIds.includes(value)),
  });
}

type HistoryEnvelope = { version: 1; entries: MemorySearchHistoryEntry[] };

export function createMemorySearchHistory(storage: StorageLike) {
  function list(): MemorySearchHistoryEntry[] {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Partial<HistoryEnvelope>;
      if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.entries)) throw new Error('invalid history envelope');
      return parsed.entries.filter(isEntry).slice(0, MAX_HISTORY).map((item) => ({
        ...item,
        criteria: normalizeMemorySearchCriteria(item.criteria),
      }));
    } catch {
      storage.removeItem(STORAGE_KEY);
      return [];
    }
  }

  function save(entry: MemorySearchHistoryEntry): void {
    const normalized = { ...entry, criteria: normalizeMemorySearchCriteria(entry.criteria) };
    const identity = criteriaIdentity(normalized.criteria);
    const entries = [normalized, ...list().filter((item) => criteriaIdentity(item.criteria) !== identity)].slice(0, MAX_HISTORY);
    write(entries);
  }

  function remove(id: string): void {
    const entries = list().filter((item) => item.id !== id);
    if (entries.length) write(entries);
    else storage.removeItem(STORAGE_KEY);
  }

  function clear(): void {
    storage.removeItem(STORAGE_KEY);
  }

  function validate(catalog: SearchCatalog): ValidatedMemorySearchHistoryEntry[] {
    const moods = new Set(catalog.moods);
    const statuses = new Set(catalog.statuses);
    const topics = new Set(catalog.topics.map((topic) => topic.id));
    return list().map((item) => ({
      ...item,
      invalidMood: Boolean(item.criteria.mood && !moods.has(item.criteria.mood)),
      invalidStatusValues: (item.criteria.statusValues ?? []).filter((status) => !statuses.has(status)),
      invalidTopicIds: (item.criteria.topicIds ?? []).filter((topicId) => !topics.has(topicId)),
    }));
  }

  function write(entries: MemorySearchHistoryEntry[]): void {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, entries } satisfies HistoryEnvelope));
  }

  return { list, save, remove, clear, validate };
}

function criteriaIdentity(criteria: MemorySearchCriteria): string {
  const normalized = normalizeMemorySearchCriteria(criteria);
  return JSON.stringify({
    ...normalized,
    keywords: [...(normalized.keywords ?? [])].sort(),
    statusValues: [...(normalized.statusValues ?? [])].sort(),
    topicIds: [...(normalized.topicIds ?? [])].sort(),
  });
}

function isEntry(value: unknown): value is MemorySearchHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<MemorySearchHistoryEntry>;
  return typeof entry.id === 'string'
    && typeof entry.displayText === 'string'
    && typeof entry.createdAt === 'string'
    && Boolean(entry.criteria && typeof entry.criteria === 'object');
}
