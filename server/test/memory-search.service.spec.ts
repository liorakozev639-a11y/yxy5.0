import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { decodeMemorySearchCursor } from '../src/memories/memory-search-cursor.js';
import { MemorySearchService, normalizeMemorySearchInput } from '../src/memories/memory-search.service.js';

function memoryRow(index: number) {
  return {
    id: `memory-${index}`,
    userId: 'local-user',
    mediaId: `media-${index}`,
    title: `第 ${index} 段记忆`,
    note: '海边日落',
    mood: '开心',
    eventAt: new Date(`2026-10-${String(index).padStart(2, '0')}T10:00:00.000Z`),
    timezone: 'Asia/Shanghai',
    statuses: ['散步'],
    echoExcluded: false,
    summaryExcluded: false,
    deletedAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    media: { id: `media-${index}` },
    topics: [{ topicId: 'topic-love', topic: { id: 'topic-love', name: '恋爱' } }],
    copyLinks: [{ copy: { id: 'copy-love', name: '恋爱长跑' } }],
  };
}

describe('MemorySearchService', () => {
  it('defaults keyword searches to relevance and filter-only searches to newest', () => {
    expect(normalizeMemorySearchInput({ keywords: ['海边'], pageSize: 5 })).toMatchObject({ sort: 'RELEVANCE', matchMode: 'EXACT' });
    expect(normalizeMemorySearchInput({ mood: '开心', pageSize: 5 })).toMatchObject({ sort: 'NEWEST', matchMode: 'EXACT' });
  });
  it('hydrates five ranked rows in SQL order and emits a stable continuation cursor', async () => {
    const ranked = Array.from({ length: 6 }, (_, index) => ({
      id: `memory-${index + 1}`,
      score: 3 - index * 0.1,
      eventAt: new Date(`2026-10-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`),
    }));
    const hydrated = [memoryRow(3), memoryRow(1), memoryRow(5), memoryRow(2), memoryRow(4)];
    const prisma = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce(ranked)
        .mockResolvedValueOnce([{ count: 12n }]),
      memory: { findMany: vi.fn(async () => hydrated) },
    };
    const service = new MemorySearchService(prisma as any);

    const result = await service.search('local-user', { keywords: ['海边'], sort: 'RELEVANCE', pageSize: 5 });

    expect(prisma.memory.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['memory-1', 'memory-2', 'memory-3', 'memory-4', 'memory-5'] } },
    }));
    expect(result.items.map((item) => item.id)).toEqual(['memory-1', 'memory-2', 'memory-3', 'memory-4', 'memory-5']);
    expect(result.total).toBe(12);
    expect(result.items[0]).toMatchObject({
      imageUrl: '/api/media/media-1/file',
      topicIds: ['topic-love'],
      longTermCopies: [{ id: 'copy-love', name: '恋爱长跑' }],
    });
    expect(decodeMemorySearchCursor(result.nextCursor!)).toEqual({
      score: ranked[4].score,
      eventAt: ranked[4].eventAt.toISOString(),
      id: 'memory-5',
    });
  });

  it('rejects an invalid cursor before issuing SQL', async () => {
    const prisma = { $queryRaw: vi.fn(), memory: { findMany: vi.fn() } };
    const service = new MemorySearchService(prisma as any);

    await expect(service.search('local-user', { cursor: 'invalid', pageSize: 5 })).rejects.toThrow(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns at most three positive one-condition relaxation suggestions without broadened rows', async () => {
    const prisma = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0n }])
        .mockResolvedValueOnce([{ count: 2n }])
        .mockResolvedValueOnce([{ count: 0n }])
        .mockResolvedValueOnce([{ count: 4n }])
        .mockResolvedValueOnce([{ count: 6n }]),
      memory: { findMany: vi.fn() },
    };
    const service = new MemorySearchService(prisma as any);

    const result = await service.search('local-user', {
      mood: '开心',
      statusValues: ['散步'],
      topicIds: ['topic-love'],
      keywords: ['海边'],
      pageSize: 5,
    });

    expect(result.items).toEqual([]);
    expect(prisma.memory.findMany).not.toHaveBeenCalled();
    expect(result.relaxationSuggestions).toEqual([
      { field: 'mood', value: '开心', resultCount: 2 },
      { field: 'topic', value: 'topic-love', resultCount: 4 },
      { field: 'keyword', value: '海边', resultCount: 6 },
    ]);
  });
});
