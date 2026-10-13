import { describe, expect, it, vi } from 'vitest';
import { ApiLongTermCopyRepository } from './api-long-term-copy-repository';

describe('ApiLongTermCopyRepository', () => {
  it('creates a copy with topic and lifecycle fields', async () => {
    const request = vi.fn(async (_path: string, _init?: RequestInit) => ({ id: 'copy-1', name: '我的考研时光', topicId: 'topic-exam', startDate: '2026-10-01', lifecycleStatus: 'ACTIVE', autoCollectEnabled: false }));
    const repository = new ApiLongTermCopyRepository({ request } as never);

    await repository.create({ name: '我的考研时光', topicId: 'topic-exam', startDate: '2026-10-01', lifecycleStatus: 'ACTIVE', autoCollectEnabled: false, backfill: true });
    expect(request).toHaveBeenCalledWith('/api/long-term-copies', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: '我的考研时光', topicId: 'topic-exam', startDate: '2026-10-01', lifecycleStatus: 'ACTIVE', autoCollectEnabled: false, backfill: true }) }));
  });

  it('maps timeline items and keeps the next cursor', async () => {
    const request = vi.fn(async () => ({ items: [{ memoryId: 'memory-1', eventAt: '2026-10-12T10:00:00.000Z', imageUrl: '/api/media/media-1/file', note: '第一天', statuses: ['学习'], topics: [{ id: 'topic-exam', name: '考研' }] }], nextCursor: 'memory-1' }));
    const repository = new ApiLongTermCopyRepository({ request } as never);

    await expect(repository.timeline('copy-1', { pageSize: 1 })).resolves.toEqual(expect.objectContaining({ nextCursor: 'memory-1', items: [expect.objectContaining({ memoryId: 'memory-1' })] }));
  });
});
