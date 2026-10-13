import { describe, expect, it, vi } from 'vitest';
import { EchoesService } from '../src/echoes/echoes.service.js';

const now = new Date('2026-10-13T04:00:00.000Z');

function memory(id: string, eventAt: string, topicId: string) {
  return {
    id,
    userId: 'local-user',
    mediaId: `media-${id}`,
    title: id,
    note: '',
    mood: '平静',
    eventAt: new Date(eventAt),
    timezone: 'Asia/Shanghai',
    statuses: [],
    echoExcluded: false,
    deletedAt: null,
    createdAt: new Date(eventAt),
    updatedAt: new Date(eventAt),
    media: { id: `media-${id}` },
    topics: [{ topic: { id: topicId, name: topicId, echoEnabled: true } }],
  };
}

function makePrisma() {
  const snapshots: any[] = [];
  const generatedDays = new Set<string>();
  const memories = [
    memory('memory-a', '2023-10-13T04:00:00.000Z', 'topic-a'),
    memory('memory-b', '2024-04-01T04:00:00.000Z', 'topic-b'),
    memory('memory-c', '2024-05-01T04:00:00.000Z', 'topic-c'),
    memory('memory-d', '2024-06-01T04:00:00.000Z', 'topic-d'),
  ];
  const prisma: any = {
    echoPreference: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(),
    },
    echoGeneration: {
      findUnique: vi.fn(async ({ where }: any) => generatedDays.has(where.userId_echoDate.echoDate.toISOString()) ? { ...where.userId_echoDate } : null),
      create: vi.fn(async ({ data }: any) => { generatedDays.add(data.echoDate.toISOString()); return data; }),
    },
    memoryEcho: {
      findMany: vi.fn(async ({ where }: any) => {
        if (where.echoDate instanceof Date) return snapshots;
        return [];
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = {
          id: `echo-${snapshots.length + 1}`,
          ...data,
          status: 'ACTIVE',
          viewedAt: null,
          createdAt: now,
          memory: memories.find((item) => item.id === data.memoryId),
          comparisonMemory: null,
          sourceTopic: memories.find((item) => item.id === data.memoryId)?.topics[0]?.topic ?? null,
          reflection: null,
        };
        snapshots.push(row);
        return row;
      }),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    memory: { findMany: vi.fn(async () => memories), updateMany: vi.fn() },
    topic: { findMany: vi.fn(async () => []), updateMany: vi.fn() },
    longTermCopy: { findMany: vi.fn(async () => []) },
    echoReflection: { upsert: vi.fn(), findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
  };
  return { prisma, snapshots };
}

describe('EchoesService', () => {
  it('generates at most three stable echoes for one day', async () => {
    const { prisma } = makePrisma();
    const service = new EchoesService(prisma);

    const first = await service.today('local-user', now);
    const second = await service.today('local-user', now);

    expect(first).toHaveLength(3);
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));
    expect(prisma.memoryEcho.create).toHaveBeenCalledTimes(3);
  });

  it('does not generate echoes when the user has disabled the feature', async () => {
    const { prisma } = makePrisma();
    prisma.echoPreference.findUnique = vi.fn(async () => ({ userId: 'local-user', enabled: false, excludedMoods: [] }));
    const service = new EchoesService(prisma);

    await expect(service.today('local-user', now)).resolves.toEqual([]);
    expect(prisma.memory.findMany).not.toHaveBeenCalled();
  });

  it('locks an empty daily result so later requests stay stable', async () => {
    const { prisma } = makePrisma();
    const originalMemories = await prisma.memory.findMany();
    prisma.memory.findMany = vi.fn().mockResolvedValueOnce([]).mockResolvedValue(originalMemories);
    const service = new EchoesService(prisma);

    await expect(service.today('local-user', now)).resolves.toEqual([]);
    await expect(service.today('local-user', now)).resolves.toEqual([]);
    expect(prisma.echoGeneration.create).toHaveBeenCalledTimes(1);
    expect(prisma.memoryEcho.create).not.toHaveBeenCalled();
  });

  it('counts dismissed snapshots in the thirty-day repeat exclusion', async () => {
    const { prisma } = makePrisma();
    const service = new EchoesService(prisma);
    await service.today('local-user', now);
    const recentCall = prisma.memoryEcho.findMany.mock.calls.find(([input]: any[]) => input.where.echoDate?.gte && input.where.echoDate?.lt);
    expect(recentCall?.[0].where).not.toHaveProperty('status');
  });

  it('persists the source topic used to generate each echo', async () => {
    const { prisma } = makePrisma();
    const service = new EchoesService(prisma);
    await service.today('local-user', now);
    expect(prisma.memoryEcho.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sourceTopicId: expect.any(String) }) }));
  });

  it('upserts a reflection without changing the original memory', async () => {
    const { prisma } = makePrisma();
    prisma.memoryEcho.findFirst = vi.fn(async () => ({ id: 'echo-1', userId: 'local-user', memoryId: 'memory-a', echoDate: now }));
    prisma.echoReflection.upsert = vi.fn(async ({ create }: any) => ({ id: 'reflection-1', ...create, updatedAt: now }));
    const service = new EchoesService(prisma);

    const result = await service.upsertReflection('local-user', 'echo-1', '  现在的我更从容了  ');

    expect(result).toMatchObject({ text: '现在的我更从容了', memoryId: 'memory-a' });
    expect(prisma.memory.updateMany).not.toHaveBeenCalled();
  });

  it('lists long-lived reflections for an original memory', async () => {
    const { prisma } = makePrisma();
    prisma.memory.findFirst = vi.fn(async () => ({ id: 'memory-a', userId: 'local-user', deletedAt: null }));
    prisma.echoReflection.findMany = vi.fn(async () => [{ id: 'reflection-1', memoryId: 'memory-a', text: '后来我做到了', sourceEchoDate: now }]);
    const service = new EchoesService(prisma);

    await expect(service.listReflections('local-user', 'memory-a')).resolves.toEqual([
      expect.objectContaining({ text: '后来我做到了' }),
    ]);
  });
});
