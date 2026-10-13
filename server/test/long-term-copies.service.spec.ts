import { describe, expect, it, vi } from 'vitest';
import { LongTermCopiesService } from '../src/long-term-copies/long-term-copies.service.js';

describe('LongTermCopiesService', () => {
  it('only accepts new automatic links for ACTIVE copies', async () => {
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
      topic: { findFirst: vi.fn(async () => ({ id: 'topic-a', userId: 'local-user', name: '考研' })) },
      longTermCopy: { findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'copy-new', userId: 'local-user', topicId: 'topic-a', lifecycleStatus: 'ACTIVE', autoCollectEnabled: false }), findMany: vi.fn(async () => [{ id: 'copy-active', lifecycleStatus: 'ACTIVE', topicId: 'topic-a' }]), create: vi.fn(async ({ data }: any) => ({ id: 'copy-new', ...data })) },
      memory: { findMany: vi.fn(async () => []) },
      longTermCopyMemory: { createMany: vi.fn(async () => ({ count: 1 })), findMany: vi.fn(async () => []) },
    };
    const service = new LongTermCopiesService(prisma as never);

    const result = await service.create('local-user', { name: '我的考研时光', topicId: 'topic-a', startDate: '2026-10-01T00:00:00+08:00', lifecycleStatus: 'ACTIVE', autoCollectEnabled: false } as never, false);
    expect(result.lifecycleStatus).toBe('ACTIVE');
    expect(result.autoCollectEnabled).toBe(false);
    expect(prisma.longTermCopy.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ autoCollectEnabled: false }) }));
    expect(prisma.topic.findFirst).toHaveBeenCalledWith({ where: { id: 'topic-a', userId: 'local-user' } });
  });

  it('returns timeline nodes without soft-deleted memories and provides a next cursor', async () => {
    const findMany = vi.fn(async () => [
      { linkedAt: new Date('2026-10-12T00:00:00Z'), memory: { id: 'memory-2', eventAt: new Date('2026-10-12T00:00:00Z'), note: '第二天', statuses: ['学习'], deletedAt: null, media: { id: 'media-2', storagePath: 'two.jpg', mimeType: 'image/jpeg' }, topics: [{ topic: { id: 'topic-a', name: '考研' } }] } },
      { linkedAt: new Date('2026-10-11T00:00:00Z'), memory: { id: 'memory-1', eventAt: new Date('2026-10-11T00:00:00Z'), note: '第一天', statuses: [], deletedAt: null, media: { id: 'media-1', storagePath: 'one.jpg', mimeType: 'image/jpeg' }, topics: [{ topic: { id: 'topic-a', name: '考研' } }] } },
    ]);
    const prisma = { longTermCopy: { findFirst: vi.fn(async () => ({ id: 'copy-1', userId: 'local-user' })) }, longTermCopyMemory: { findMany } };
    const service = new LongTermCopiesService(prisma as never);

    const result = await service.timeline('local-user', 'copy-1', { pageSize: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].memoryId).toBe('memory-2');
    expect(result.nextCursor).toBeTruthy();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { copyId: 'copy-1', memory: { deletedAt: null } } }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ memory: { eventAt: 'desc' } }, { memoryId: 'desc' }] }));
  });

  it('defaults automatic collection to enabled', async () => {
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
      topic: { findFirst: vi.fn(async () => ({ id: 'topic-a', userId: 'local-user', name: '考研', isNone: false })) },
      longTermCopy: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'copy-new', userId: 'local-user', topicId: 'topic-a', lifecycleStatus: 'ACTIVE', autoCollectEnabled: true }),
        create: vi.fn(async ({ data }: any) => ({ id: 'copy-new', ...data })),
      },
      memory: { findMany: vi.fn(async () => []) },
      longTermCopyMemory: { createMany: vi.fn(async () => ({ count: 0 })) },
    };
    const service = new LongTermCopiesService(prisma as never);

    const result = await service.create('local-user', { name: '考研', topicId: 'topic-a', startDate: '2026-10-01T00:00:00+08:00' }, false);
    expect(result.autoCollectEnabled).toBe(true);
    expect(prisma.longTermCopy.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ autoCollectEnabled: true }) }));
  });

  it('rejects a second long-term copy for the same topic', async () => {
    const prisma = {
      topic: { findFirst: vi.fn(async () => ({ id: 'topic-a', userId: 'local-user', name: '考研', isNone: false })) },
      longTermCopy: {
        findFirst: vi.fn(async () => ({ id: 'copy-existing', userId: 'local-user', topicId: 'topic-a' })),
        create: vi.fn(),
      },
    };
    const service = new LongTermCopiesService(prisma as never);

    await expect(service.create('local-user', { name: '另一个考研副本', topicId: 'topic-a', startDate: '2026-10-01T00:00:00+08:00' }, false)).rejects.toThrow('该主题已经有关联的长期副本');
    expect(prisma.longTermCopy.create).not.toHaveBeenCalled();
  });

  it('turns a concurrent unique constraint into a readable conflict', async () => {
    const prisma = {
      topic: { findFirst: vi.fn(async () => ({ id: 'topic-a', userId: 'local-user', name: '考研', isNone: false })) },
      longTermCopy: { findFirst: vi.fn(async () => null) },
      $transaction: vi.fn(async () => { throw { code: 'P2002' }; }),
    };
    const service = new LongTermCopiesService(prisma as never);

    await expect(service.create('local-user', { name: '考研', topicId: 'topic-a', startDate: '2026-10-01T00:00:00+08:00' }, false)).rejects.toThrow('该主题已经有关联的长期副本');
  });

  it('uses event time and memory id together for stable cursor pagination', async () => {
    const cursorTime = new Date('2026-10-12T00:00:00Z');
    const findMany = vi.fn(async () => []);
    const prisma = {
      longTermCopy: { findFirst: vi.fn(async () => ({ id: 'copy-1', userId: 'local-user' })) },
      longTermCopyMemory: {
        findUnique: vi.fn(async () => ({ memory: { eventAt: cursorTime } })),
        findMany,
      },
    };
    const service = new LongTermCopiesService(prisma as never);

    await service.timeline('local-user', 'copy-1', { cursor: 'memory-b', pageSize: 10 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { memory: { eventAt: { lt: cursorTime } } },
          { AND: [{ memory: { eventAt: cursorTime } }, { memoryId: { lt: 'memory-b' } }] },
        ],
      }),
      orderBy: [{ memory: { eventAt: 'desc' } }, { memoryId: 'desc' }],
    }));
  });
});
