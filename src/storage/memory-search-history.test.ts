import { describe, expect, it } from 'vitest';
import type { SearchCatalog } from '../domain/memory-search';
import { createMemorySearchHistory, sanitizeHistoryCriteria, type MemorySearchHistoryEntry, type StorageLike } from './memory-search-history';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function entry(index: number, overrides: Partial<MemorySearchHistoryEntry> = {}): MemorySearchHistoryEntry {
  return {
    id: `search-${index}`,
    displayText: `搜索 ${index}`,
    criteria: { keywords: [`关键词${index}`] },
    createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    ...overrides,
  };
}

describe('memory search history', () => {
  it('keeps the latest twenty searches in most-recent order', () => {
    const history = createMemorySearchHistory(new MemoryStorage());
    for (let index = 0; index < 21; index += 1) history.save(entry(index));

    expect(history.list()).toHaveLength(20);
    expect(history.list()[0].displayText).toBe('搜索 20');
    expect(history.list().at(-1)?.displayText).toBe('搜索 1');
  });

  it('deduplicates normalized criteria and refreshes the newest display text', () => {
    const history = createMemorySearchHistory(new MemoryStorage());
    history.save(entry(1, { criteria: { keywords: [' 图书馆 '], statusValues: ['学习', '散步'] } }));
    history.save(entry(2, { displayText: '再找一次', criteria: { statusValues: ['学习', '散步'], keywords: ['图书馆'] } }));

    expect(history.list()).toEqual([expect.objectContaining({ id: 'search-2', displayText: '再找一次' })]);
  });

  it('removes one search or clears all searches', () => {
    const storage = new MemoryStorage();
    const history = createMemorySearchHistory(storage);
    history.save(entry(1));
    history.save(entry(2));

    history.remove('search-2');
    expect(history.list().map((item) => item.id)).toEqual(['search-1']);
    history.clear();
    expect(history.list()).toEqual([]);
    expect(storage.values.size).toBe(0);
  });

  it('recovers from corrupt or wrong-version JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem('photo-memory-search-history-v1', '{broken');
    const history = createMemorySearchHistory(storage);
    expect(history.list()).toEqual([]);

    storage.setItem('photo-memory-search-history-v1', JSON.stringify({ version: 2, entries: [entry(1)] }));
    expect(history.list()).toEqual([]);
  });

  it('marks references that no longer exist in the current catalog', () => {
    const history = createMemorySearchHistory(new MemoryStorage());
    history.save(entry(1, { criteria: { mood: '开心', statusValues: ['学习', '旅行'], topicIds: ['topic-exam', 'topic-deleted'] } }));
    const catalog: SearchCatalog = {
      moods: ['开心'],
      statuses: ['学习'],
      topics: [{ id: 'topic-exam', name: '考研' }],
    };

    expect(history.validate(catalog)[0]).toMatchObject({
      invalidMood: false,
      invalidStatusValues: ['旅行'],
      invalidTopicIds: ['topic-deleted'],
    });
  });

  it('removes invalid catalog values before a history search is reused', () => {
    const validated = {
      ...entry(1, { criteria: { mood: '已删除心情', statusValues: ['学习', '旅行'], topicIds: ['topic-exam', 'topic-deleted'], keywords: ['海边'] } }),
      invalidMood: true,
      invalidStatusValues: ['旅行'],
      invalidTopicIds: ['topic-deleted'],
    };

    expect(sanitizeHistoryCriteria(validated)).toEqual({
      statusValues: ['学习'],
      topicIds: ['topic-exam'],
      keywords: ['海边'],
    });
  });
});
