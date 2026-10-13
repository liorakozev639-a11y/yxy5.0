import { describe, expect, it, vi } from 'vitest';
import { ApiMemoryRepository } from './api-memory-repository';

describe('ApiMemoryRepository', () => {
  it('maps the API page into the existing Memory shape', async () => {
    const client = { request: vi.fn(async () => ({ items: [{ id: 'memory-1', mediaId: 'media-1', imageUrl: '/api/media/media-1/file', title: '海边的下午', note: '海边', mood: '开心', eventAt: '2026-10-12T10:00:00.000Z', timezone: 'Asia/Shanghai', statuses: ['约会'], topicIds: ['topic-love'], topics: [{ id: 'topic-love', name: '恋爱' }], createdAt: '2026-10-12T10:00:00.000Z', updatedAt: '2026-10-12T10:00:00.000Z' }], nextCursor: undefined })) };
    const repository = new ApiMemoryRepository(client as never);

    const memories = await repository.getAll();
    expect(memories[0]).toMatchObject({ id: 'memory-1', mediaId: 'media-1', imageUrl: '/api/media/media-1/file', title: '海边的下午', note: '海边', mood: '开心', statuses: ['约会'], topicIds: ['topic-love'] });
  });

  it('loads every cursor page without duplicating memories', async () => {
    const request = vi.fn(async (path: string) => path.includes('cursor=memory-1')
      ? { items: [{ id: 'memory-2', mediaId: 'media-2', imageUrl: '/two', title: '', note: '', mood: '', eventAt: '2026-10-11T10:00:00.000Z', timezone: 'Asia/Shanghai', statuses: [], topicIds: [], topics: [], createdAt: '2026-10-11T10:00:00.000Z', updatedAt: '2026-10-11T10:00:00.000Z' }] }
      : { items: [{ id: 'memory-1', mediaId: 'media-1', imageUrl: '/one', title: '', note: '', mood: '', eventAt: '2026-10-12T10:00:00.000Z', timezone: 'Asia/Shanghai', statuses: [], topicIds: [], topics: [], createdAt: '2026-10-12T10:00:00.000Z', updatedAt: '2026-10-12T10:00:00.000Z' }], nextCursor: 'memory-1' });
    const repository = new ApiMemoryRepository({ request } as never);

    await expect(repository.getAll()).resolves.toHaveLength(2);
    expect(request).toHaveBeenNthCalledWith(2, '/api/memories?pageSize=50&cursor=memory-1');
  });

  it('uploads a replacement image before patching an existing memory', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ id: 'media-2' })
      .mockResolvedValueOnce({
        id: 'memory-1', mediaId: 'media-2', imageUrl: '/api/media/media-2/file',
        title: '新标题', note: 'updated', mood: '平静', eventAt: '2026-10-12T00:00:00.000Z', timezone: 'Asia/Shanghai',
        statuses: [], topicIds: [], topics: [],
        createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z',
      });
    const repository = new ApiMemoryRepository({ request } as never);

    await repository.put({
      id: 'memory-1', mediaId: 'media-1', imageBlob: new Blob(['replacement'], { type: 'image/jpeg' }),
      imageName: 'replacement.jpg', imageUrl: '/api/media/media-1/file', eventAt: '2026-10-12T00:00:00.000Z',
      title: '新标题', note: 'updated', mood: '平静', statuses: [], createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z',
    });

    expect(request).toHaveBeenNthCalledWith(1, '/api/media', expect.objectContaining({ method: 'POST', body: expect.any(FormData) }));
    expect(request).toHaveBeenNthCalledWith(2, '/api/memories/memory-1', expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('media-2') }));
    expect(JSON.parse(request.mock.calls[1][1].body as string)).toMatchObject({ title: '新标题', mood: '平静', statuses: [] });
    expect(request).toHaveBeenNthCalledWith(3, '/api/media/media-1', { method: 'DELETE' });
  });

  it('removes a newly uploaded file if creating the memory fails', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ id: 'media-new' })
      .mockRejectedValueOnce(new Error('database failed'))
      .mockResolvedValueOnce({ ok: true });
    const repository = new ApiMemoryRepository({ request } as never);

    await expect(repository.put({
      id: 'memory-new', imageBlob: new Blob(['new'], { type: 'image/jpeg' }), imageName: 'new.jpg', eventAt: '2026-10-12T00:00:00.000Z',
      title: '', note: '', mood: '', statuses: [], createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z',
    })).rejects.toThrow('database failed');

    expect(request).toHaveBeenNthCalledWith(3, '/api/media/media-new', { method: 'DELETE' });
  });
});
