import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('ApiClient', () => {
  it('converts non-2xx responses into ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: '保存失败' }), { status: 400, headers: { 'content-type': 'application/json' } })));
    await expect(new ApiClient().request('/api/memories', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
    await expect(new ApiClient().request('/api/memories', { method: 'POST' })).rejects.toMatchObject({ status: 400, message: '保存失败' });
  });
});
