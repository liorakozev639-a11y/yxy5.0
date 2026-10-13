export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), 15000);
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');
    try {
      const response = await fetch(path, { ...init, credentials: 'include', headers, signal: controller.signal });
      const text = await response.text();
      let body: unknown = undefined;
      try { body = text ? JSON.parse(text) : undefined; } catch { body = text; }
      if (!response.ok) {
        if (response.status === 401 && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('photo-memory-lock-required'));
        }
        const message = typeof body === 'object' && body && 'message' in body ? String((body as { message: unknown }).message) : `请求失败（${response.status}）`;
        throw new ApiError(response.status, message);
      }
      return body as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError(408, '请求超时，请稍后重试');
      throw new ApiError(0, '网络连接失败，请确认后端服务已启动');
    } finally {
      globalThis.clearTimeout(timer);
    }
  }
}
