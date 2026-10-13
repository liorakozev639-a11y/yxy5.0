import { describe, expect, it, vi } from 'vitest';
import { ApiTopicRepository } from './api-topic-repository';

describe('ApiTopicRepository', () => {
  it('updates the long-term-copy prompt preference', async () => {
    const request = vi.fn(async () => ({ id: 'topic-love', name: '恋爱', suppressLongTermPrompt: true }));
    const repository = new ApiTopicRepository({ request } as never);

    await repository.update('topic-love', { suppressLongTermPrompt: true });

    expect(request).toHaveBeenCalledWith('/api/topics/topic-love', {
      method: 'PATCH',
      body: JSON.stringify({ suppressLongTermPrompt: true }),
    });
  });
});
