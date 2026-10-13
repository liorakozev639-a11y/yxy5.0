import { describe, expect, it, vi } from 'vitest';
import { TopicsService } from '../src/topics/topics.service.js';

describe('TopicsService', () => {
  it('rejects duplicate topic names for one user', async () => {
    const prisma = {
      topic: {
        findFirst: vi.fn(async () => ({ id: 'topic-existing', userId: 'local-user', name: '考研' })),
        create: vi.fn(),
      },
    };
    const service = new TopicsService(prisma as never);

    await expect(service.create('local-user', { name: '考研' })).rejects.toThrow('主题名称已经存在');
    expect(prisma.topic.create).not.toHaveBeenCalled();
  });

  it('lists only topics owned by the current user', async () => {
    const findMany = vi.fn(async () => [{ id: 'topic-1', userId: 'local-user', name: '恋爱' }]);
    const prisma = { topic: { findMany } };
    const service = new TopicsService(prisma as never);

    await expect(service.list('local-user')).resolves.toEqual([{ id: 'topic-1', userId: 'local-user', name: '恋爱' }]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'local-user' } }));
  });

  it('updates the long-term-copy prompt suppression preference', async () => {
    const update = vi.fn(async ({ data }: any) => ({ id: 'topic-1', userId: 'local-user', name: '恋爱', ...data }));
    const prisma = {
      topic: {
        findFirst: vi.fn(async () => ({ id: 'topic-1', userId: 'local-user', name: '恋爱' })),
        update,
      },
    };
    const service = new TopicsService(prisma as never);

    await expect(service.update('local-user', 'topic-1', { suppressLongTermPrompt: true } as never)).resolves.toMatchObject({ suppressLongTermPrompt: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ suppressLongTermPrompt: true }) }));
  });

  it('lets the owner disable future echoes for a topic', async () => {
    const update = vi.fn(async () => ({ id: 'topic-1', userId: 'local-user', name: '恋爱', echoEnabled: false }));
    const prisma = {
      topic: {
        findFirst: vi.fn(async () => ({ id: 'topic-1', userId: 'local-user', name: '恋爱' })),
        update,
      },
    };
    const service = new TopicsService(prisma as never);

    await expect(service.setEchoEnabled('local-user', 'topic-1', false)).resolves.toMatchObject({ echoEnabled: false });
    expect(update).toHaveBeenCalledWith({ where: { id: 'topic-1' }, data: { echoEnabled: false } });
  });
});
