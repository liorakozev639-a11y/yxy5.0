import { describe, expect, it } from 'vitest';
import type { Memory } from './memory';
import { memoryMatchesExactCriteria, normalizeMemorySearchCriteria } from './memory-search';

const memory: Memory = {
  id: 'memory-1',
  imageBlob: new Blob(['photo']),
  imageName: 'library.jpg',
  eventAt: '2026-10-12T10:00:00.000Z',
  title: '图书馆的下午',
  note: '完成复习后走回宿舍',
  mood: '开心',
  statuses: ['学习', '散步'],
  topicIds: ['topic-exam'],
  topics: [{ id: 'topic-exam', name: '考研' }],
  createdAt: '2026-10-12T10:00:00.000Z',
  updatedAt: '2026-10-12T10:00:00.000Z',
};

describe('memory search criteria', () => {
  it('trims, deduplicates and preserves the confirmed limits', () => {
    expect(normalizeMemorySearchCriteria({
      mood: ' 开心 ',
      keywords: [' 图书馆 ', '图书馆', '复习'],
      statusValues: [' 学习 ', '散步', '学习'],
      topicIds: [' topic-exam ', 'topic-exam'],
      sort: 'RELEVANCE',
      matchMode: 'EXACT',
    })).toEqual({
      mood: '开心',
      keywords: ['图书馆', '复习'],
      statusValues: ['学习', '散步'],
      topicIds: ['topic-exam'],
      sort: 'RELEVANCE',
      matchMode: 'EXACT',
    });
  });

  it('rejects values beyond the agreed search limits', () => {
    expect(() => normalizeMemorySearchCriteria({ keywords: ['一'.repeat(101)] })).toThrow('搜索文字不能超过100个字符');
    expect(() => normalizeMemorySearchCriteria({ keywords: ['1', '2', '3', '4', '5', '6'] })).toThrow('最多添加5个关键词');
    expect(() => normalizeMemorySearchCriteria({ statusValues: Array.from({ length: 11 }, (_, index) => `状态${index}`) })).toThrow('最多选择10个状态');
    expect(() => normalizeMemorySearchCriteria({ topicIds: Array.from({ length: 11 }, (_, index) => `topic-${index}`) })).toThrow('最多选择10个主题');
  });

  it('requires every confirmed condition while restricting keywords to title and note', () => {
    expect(memoryMatchesExactCriteria(memory, {
      mood: '开心',
      statusValues: ['学习', '散步'],
      topicIds: ['topic-exam'],
      keywords: ['图书馆', '复习'],
    })).toBe(true);
    expect(memoryMatchesExactCriteria(memory, { statusValues: ['学习', '旅行'] })).toBe(false);
    expect(memoryMatchesExactCriteria(memory, { topicIds: ['topic-exam', 'topic-love'] })).toBe(false);
    expect(memoryMatchesExactCriteria(memory, { keywords: ['考研'] })).toBe(false);
  });

  it('uses an inclusive start and exclusive end date', () => {
    expect(memoryMatchesExactCriteria(memory, { from: '2026-10-12T00:00:00.000Z', to: '2026-10-13T00:00:00.000Z' })).toBe(true);
    expect(memoryMatchesExactCriteria(memory, { to: '2026-10-12T10:00:00.000Z' })).toBe(false);
  });
});
