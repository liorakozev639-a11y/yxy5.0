import { describe, expect, it, vi } from 'vitest';
import { ApiMemoryEchoRepository } from './api-memory-echo-repository';

const apiMemory = {
  id: 'memory-1',
  mediaId: 'media-1',
  imageUrl: '/api/media/media-1/file',
  title: '湖边的午后',
  note: '风很轻',
  mood: '开心',
  eventAt: '2023-10-13T04:00:00.000Z',
  timezone: 'Asia/Shanghai',
  statuses: ['旅行'],
  topicIds: ['topic-1'],
  topics: [{ id: 'topic-1', name: '旅行' }],
  echoExcluded: false,
  createdAt: '2023-10-13T04:00:00.000Z',
  updatedAt: '2023-10-13T04:00:00.000Z',
};

const apiEcho = {
  id: 'echo-1',
  echoDate: '2026-10-13',
  type: 'ON_THIS_DAY',
  reason: '3年前的今天',
  score: 100,
  displayOrder: 1,
  status: 'ACTIVE',
  memoryAvailable: true,
  comparisonMemoryAvailable: false,
  memory: apiMemory,
};

describe('ApiMemoryEchoRepository', () => {
  it('loads and maps today echoes', async () => {
    const request = vi.fn(async () => [apiEcho]);
    const repository = new ApiMemoryEchoRepository({ request } as never);

    const echoes = await repository.today();

    expect(request).toHaveBeenCalledWith('/api/echoes/today');
    expect(echoes[0]).toMatchObject({ id: 'echo-1', reason: '3年前的今天', memory: { id: 'memory-1', imageName: 'memory.jpg' } });
  });

  it('loads thirty days of echo history', async () => {
    const request = vi.fn(async () => [apiEcho]);
    const repository = new ApiMemoryEchoRepository({ request } as never);

    await repository.list(30);
    expect(request).toHaveBeenCalledWith('/api/echoes?days=30');
  });

  it('saves reflection text and can load long-lived reflections', async () => {
    const request = vi.fn(async () => ({ id: 'reflection-1', memoryId: 'memory-1', text: '新的感受', sourceEchoDate: '2026-10-13', updatedAt: '2026-10-13T04:00:00.000Z' }));
    const repository = new ApiMemoryEchoRepository({ request } as never);

    await repository.saveReflection('echo-1', '新的感受');
    await repository.listReflections('memory-1');

    expect(request).toHaveBeenNthCalledWith(1, '/api/echoes/echo-1/reflection', { method: 'PUT', body: JSON.stringify({ text: '新的感受' }) });
    expect(request).toHaveBeenNthCalledWith(2, '/api/echoes/reflections/memory-1');
  });

  it('supports dismiss and every user-controlled setting', async () => {
    const request = vi.fn(async () => ({ ok: true }));
    const repository = new ApiMemoryEchoRepository({ request } as never);

    await repository.dismiss('echo-1');
    await repository.setMemoryExcluded('memory-1', true);
    await repository.setTopicEnabled('topic-1', false);
    await repository.updatePreferences({ enabled: false, excludedMoods: ['焦虑'] });

    expect(request).toHaveBeenNthCalledWith(1, '/api/echoes/echo-1/dismiss', { method: 'POST' });
    expect(request).toHaveBeenNthCalledWith(2, '/api/memories/memory-1/echo-setting', { method: 'PATCH', body: JSON.stringify({ echoExcluded: true }) });
    expect(request).toHaveBeenNthCalledWith(3, '/api/topics/topic-1/echo-setting', { method: 'PATCH', body: JSON.stringify({ echoEnabled: false }) });
    expect(request).toHaveBeenNthCalledWith(4, '/api/echoes/preferences/current', { method: 'PATCH', body: JSON.stringify({ enabled: false, excludedMoods: ['焦虑'] }) });
  });
});
