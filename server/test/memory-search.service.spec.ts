import { describe, expect, it, vi } from 'vitest';
import { MemorySearchService } from '../src/memories/memory-search.service.js';

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
  it('builds an AND query scoped to the active memories of one user', async () => {
    const prisma = {
      memory: {
        count: vi.fn(async () => 1),
        findMany: vi.fn(async () => [memoryRow(1)]),
      },
    };
    const service = new MemorySearchService(prisma as any);

    await service.search('local-user', {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
      mood: '开心',
      statusValues: ['散步', '约会'],
      topicIds: ['topic-love', 'topic-study'],
      keywords: ['海边', '日落'],
      sort: 'NEWEST',
      matchMode: 'EXACT',
      pageSize: 5,
    });

    const where = prisma.memory.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      userId: 'local-user',
      deletedAt: null,
      eventAt: {
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lt: new Date('2026-11-01T00:00:00.000Z'),
      },
      mood: '开心',
      statuses: { hasEvery: ['散步', '约会'] },
    });
    expect(where.AND).toEqual([
      { topics: { some: { topicId: 'topic-love' } } },
      { topics: { some: { topicId: 'topic-study' } } },
      { OR: [{ title: { contains: '海边', mode: 'insensitive' } }, { note: { contains: '海边', mode: 'insensitive' } }] },
      { OR: [{ title: { contains: '日落', mode: 'insensitive' } }, { note: { contains: '日落', mode: 'insensitive' } }] },
    ]);
    expect(prisma.memory.count).toHaveBeenCalledWith({ where });
  });

  it('returns five items, a continuation cursor, total count and linked copy names', async () => {
    const rows = Array.from({ length: 6 }, (_, index) => memoryRow(index + 1));
    const prisma = {
      memory: {
        count: vi.fn(async () => 12),
        findMany: vi.fn(async () => rows),
      },
    };
    const service = new MemorySearchService(prisma as any);

    const result = await service.search('local-user', { pageSize: 5 });

    expect(prisma.memory.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 6 }));
    expect(result.items).toHaveLength(5);
    expect(result.nextCursor).toBe('memory-5');
    expect(result.total).toBe(12);
    expect(result.items[0]).toMatchObject({
      id: 'memory-1',
      imageUrl: '/api/media/media-1/file',
      topicIds: ['topic-love'],
      longTermCopies: [{ id: 'copy-love', name: '恋爱长跑' }],
    });
  });
});
