import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('ApiClient', () => {
  it('converts non-2xx responses into ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: '保存失败' }), { status: 400, headers: { 'content-type': 'application/json' } })));
    await expect(new ApiClient().request('/api/memories', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
    await expect(new ApiClient().request('/api/memories', { method: 'POST' })).rejects.toMatchObject({ status: 400, message: '保存失败' });
  });

  it('always carries the HttpOnly app-lock cookie and announces locked responses', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ message: '应用已锁定' }), { status: 401 }));
    const dispatch = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { dispatchEvent: dispatch });

    await expect(new ApiClient().request('/api/memories')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
    expect(dispatch).toHaveBeenCalled();
  });
});
