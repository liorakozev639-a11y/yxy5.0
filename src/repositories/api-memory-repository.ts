import type { Memory, MemoryDraft } from '../domain/memory';
import { ApiClient } from '../api/client';

export type ApiMemory = {
  id: string;
  mediaId: string;
  imageUrl: string;
  originalName?: string;
  title: string;
  note: string;
  mood: string;
  eventAt: string;
  timezone: string;
  statuses: string[];
  topicIds: string[];
  topics: Array<{ id: string; name: string }>;
  echoExcluded?: boolean;
  createdAt: string;
  updatedAt: string;
};

type MemoryPage = { items: ApiMemory[]; nextCursor?: string };

export class ApiMemoryRepository {
  constructor(private readonly client: ApiClient) {}

  async get(id: string): Promise<Memory | undefined> {
    try { return this.map(await this.client.request<ApiMemory>(`/api/memories/${id}`)); } catch (error: any) {
      if (error?.status === 404) return undefined;
      throw error;
    }
  }

  async getAll(): Promise<Memory[]> {
    const memories: Memory[] = [];
    const seenCursors = new Set<string>();
    let path = '/api/memories?pageSize=50';
    while (path) {
      const page = await this.client.request<MemoryPage>(path);
      memories.push(...page.items.map((item) => this.map(item)));
      if (!page.nextCursor || seenCursors.has(page.nextCursor)) break;
      seenCursors.add(page.nextCursor);
      path = `/api/memories?pageSize=50&cursor=${encodeURIComponent(page.nextCursor)}`;
    }
    return memories;
  }

  async list(query = ''): Promise<Memory[]> {
    const page = await this.client.request<MemoryPage>(`/api/memories${query ? `?${query}` : ''}`);
    return page.items.map((item) => this.map(item));
  }

  async put(memory: Memory): Promise<Memory> {
    let mediaId = memory.mediaId;
    let uploadedMediaId: string | undefined;
    if (memory.imageBlob?.size) {
      const formData = new FormData();
      formData.append('file', memory.imageBlob, memory.imageName);
      const media = await this.client.request<{ id: string }>('/api/media', { method: 'POST', body: formData });
      mediaId = media.id;
      uploadedMediaId = media.id;
    }
    if (!mediaId) throw new Error('先放入一张照片，再保存这段记忆');
    const payload = {
      mediaId,
      title: memory.title,
      note: memory.note,
      mood: memory.mood,
      eventAt: memory.eventAt,
      statuses: unique(memory.statuses),
      topics: memory.topicIds ?? [],
    };
    let response: ApiMemory;
    try {
      response = memory.mediaId ? await this.client.request<ApiMemory>(`/api/memories/${memory.id}`, { method: 'PATCH', body: JSON.stringify(payload) }) : await this.client.request<ApiMemory>('/api/memories', { method: 'POST', body: JSON.stringify(payload) });
    } catch (error) {
      if (uploadedMediaId) await this.cleanupMedia(uploadedMediaId);
      throw error;
    }
    if (uploadedMediaId && memory.mediaId && memory.mediaId !== uploadedMediaId) await this.cleanupMedia(memory.mediaId);
    return this.map(response);
  }

  async remove(id: string): Promise<void> {
    await this.client.request(`/api/memories/${id}`, { method: 'DELETE' });
  }

  private map(item: ApiMemory): Memory {
    return mapApiMemory(item);
  }

  private async cleanupMedia(id: string) {
    try { await this.client.request(`/api/media/${id}`, { method: 'DELETE' }); } catch { /* best-effort orphan cleanup */ }
  }
}

export function mapApiMemory(item: ApiMemory): Memory {
  return {
    id: item.id,
    imageBlob: new Blob(),
    imageName: item.originalName ?? 'memory.jpg',
    imageUrl: item.imageUrl,
    mediaId: item.mediaId,
    eventAt: item.eventAt,
    title: item.title ?? '',
    note: item.note,
    mood: item.mood ?? '',
    statuses: item.statuses ?? [],
    topicIds: item.topicIds ?? item.topics?.map((topic) => topic.id) ?? [],
    topics: item.topics ?? [],
    echoExcluded: item.echoExcluded ?? false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function unique(values: string[]) { return [...new Set(values.map((value) => value.trim()).filter(Boolean))]; }

export type MemoryRepositoryLike = Pick<ApiMemoryRepository, 'get' | 'getAll' | 'put' | 'remove'>;
export type MemoryDraftWithApi = MemoryDraft;
