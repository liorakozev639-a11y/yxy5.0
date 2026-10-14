import { describe, expect, it, vi } from 'vitest';
import { MemoriesService } from '../src/memories/memories.service.js';

function makePrisma() {
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
    mediaAsset: { findFirst: vi.fn(async () => ({ id: 'media-1', userId: 'local-user', mimeType: 'image/jpeg', storagePath: 'media-1.jpg' })) },
    topic: { findMany: vi.fn(async () => [{ id: 'topic-a', userId: 'local-user', name: '考研', isNone: false }, { id: 'topic-b', userId: 'local-user', name: '读研', isNone: false }]) },
    memory: { create: vi.fn(async ({ data }: any) => ({ id: 'memory-1', ...data, media: { id: data.mediaId, storagePath: 'media-1.jpg', mimeType: 'image/jpeg' }, topics: [], copyLinks: [] })) },
    longTermCopy: { findMany: vi.fn(async () => [{ id: 'copy-a', topicId: 'topic-a', lifecycleStatus: 'ACTIVE' }, { id: 'copy-b', topicId: 'topic-b', lifecycleStatus: 'ACTIVE' }]) },
    longTermCopyMemory: { createMany: vi.fn(async () => ({ count: 2 })) },
  };
  return prisma;
}

describe('MemoriesService', () => {
  it('creates a memory with multiple statuses and topics and links active copies', async () => {
    const prisma = makePrisma();
    const service = new MemoriesService(prisma as never);

    const result = await service.create('local-user', {
      mediaId: 'media-1',
      title: '第一次模考',
      note: '第一次模拟考试',
      mood: '焦虑',
      eventAt: '2026-10-12T18:30:00+08:00',
      statuses: ['焦虑', '学习'],
      topics: ['topic-a', 'topic-b'],
    } as never);

    expect(result).toMatchObject({ title: '第一次模考', mood: '焦虑' });
    expect(prisma.memory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: '第一次模考', mood: '焦虑', statuses: ['焦虑', '学习'] }) }));
    expect(prisma.longTermCopyMemory.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.arrayContaining([{ copyId: 'copy-a', memoryId: 'memory-1' }, { copyId: 'copy-b', memoryId: 'memory-1' }]) }));
  });

  it('allows title, mood, note, statuses and topics to all be empty', async () => {
    const prisma = makePrisma();
    prisma.topic.findMany = vi.fn(async () => []);
    prisma.longTermCopy.findMany = vi.fn(async () => []);
    const service = new MemoriesService(prisma as never);

    await service.create('local-user', { mediaId: 'media-1', note: '', eventAt: '2026-10-12T18:30:00+08:00', statuses: [], topics: [] });
    expect(prisma.memory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.not.objectContaining({ isPending: expect.anything() }) }));
  });

  it('filters soft-deleted memories in list queries', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = { memory: { findMany }, mediaAsset: {}, topic: {}, longTermCopyMemory: {} };
    const service = new MemoriesService(prisma as never);

    await service.list('local-user', {});
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'local-user', deletedAt: null }) }));
  });

  it('searches title, note, mood, status and topic name', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = { memory: { findMany } };
    const service = new MemoriesService(prisma as never);

    await service.list('local-user', { keyword: '开心' });

    const call = findMany.mock.calls[0][0] as any;
    expect(call.where.OR).toEqual(expect.arrayContaining([
      { title: { contains: '开心', mode: 'insensitive' } },
      { note: { contains: '开心', mode: 'insensitive' } },
      { mood: { contains: '开心', mode: 'insensitive' } },
      { statuses: { has: '开心' } },
      { topics: { some: { topic: { name: { contains: '开心', mode: 'insensitive' } } } } },
    ]));
  });

  it('removes links for deselected topics and links newly eligible copies on update', async () => {
    const current = { id: 'memory-1', userId: 'local-user', mediaId: 'media-1', title: '', note: '', mood: '', eventAt: new Date('2026-10-12T10:00:00Z'), timezone: 'Asia/Shanghai', statuses: [], deletedAt: null, topics: [{ topicId: 'topic-old' }] };
    const updated = { ...current, title: '更新后', mood: '开心', topics: [{ topic: { id: 'topic-new', name: '读研' } }], media: { id: 'media-1' }, createdAt: new Date(), updatedAt: new Date() };
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
      memory: {
        findFirst: vi.fn().mockResolvedValueOnce(current).mockResolvedValueOnce(updated),
        update: vi.fn(async () => updated),
      },
      mediaAsset: { findFirst: vi.fn() },
      topic: { findMany: vi.fn(async () => [{ id: 'topic-new', userId: 'local-user', name: '读研' }]) },
      memoryTopic: { deleteMany: vi.fn(async () => ({ count: 1 })), createMany: vi.fn(async () => ({ count: 1 })) },
      longTermCopy: { findMany: vi.fn(async () => [{ id: 'copy-new', topicId: 'topic-new', lifecycleStatus: 'ACTIVE', autoCollectEnabled: true }]) },
      longTermCopyMemory: { deleteMany: vi.fn(async () => ({ count: 1 })), createMany: vi.fn(async () => ({ count: 1 })) },
    };
    const service = new MemoriesService(prisma as never);

    await service.update('local-user', 'memory-1', { title: '更新后', mood: '开心', topics: ['topic-new'] } as never);

    expect(prisma.longTermCopyMemory.deleteMany).toHaveBeenCalledWith({ where: { memoryId: 'memory-1', copy: { topicId: { notIn: ['topic-new'] } } } });
    expect(prisma.longTermCopy.findMany).toHaveBeenCalledWith({ where: { userId: 'local-user', topicId: { in: ['topic-new'] }, lifecycleStatus: 'ACTIVE', autoCollectEnabled: true } });
    expect(prisma.longTermCopyMemory.createMany).toHaveBeenCalledWith({ data: [{ copyId: 'copy-new', memoryId: 'memory-1' }], skipDuplicates: true });
  });

  it('lets the owner exclude a memory from future echoes', async () => {
    const update = vi.fn(async () => ({ id: 'memory-1', echoExcluded: true }));
    const prisma = {
      memory: {
        findFirst: vi.fn(async () => ({ id: 'memory-1', userId: 'local-user', deletedAt: null })),
        update,
      },
    };
    const service = new MemoriesService(prisma as never);

    await expect(service.setEchoExcluded('local-user', 'memory-1', true)).resolves.toMatchObject({ echoExcluded: true });
    expect(update).toHaveBeenCalledWith({ where: { id: 'memory-1' }, data: { echoExcluded: true } });
  });

  it('lets the owner exclude a memory from future monthly and yearly summaries', async () => {
    const update = vi.fn(async () => ({ id: 'memory-1', summaryExcluded: true }));
    const prisma = {
      memory: {
        findFirst: vi.fn(async () => ({ id: 'memory-1', userId: 'local-user', deletedAt: null })),
        update,
      },
    };
    const service = new MemoriesService(prisma as never);

    await expect(service.setSummaryExcluded('local-user', 'memory-1', true)).resolves.toMatchObject({ summaryExcluded: true });
    expect(update).toHaveBeenCalledWith({ where: { id: 'memory-1' }, data: { summaryExcluded: true } });
  });
});
