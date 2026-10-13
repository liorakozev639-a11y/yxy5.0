import { ApiClient } from '../api/client';

export type LifecycleStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
export type LongTermCopy = { id: string; name: string; topicId: string; startDate: string; lifecycleStatus: LifecycleStatus; autoCollectEnabled: boolean; topic?: { id: string; name: string }; coverMedia?: { id: string } | null };
export type LongTermCopyInput = { name: string; topicId: string; startDate: string; lifecycleStatus: LifecycleStatus; autoCollectEnabled?: boolean; backfill?: boolean };
export type LongTermCopyUpdateInput = Partial<Omit<LongTermCopyInput, 'topicId' | 'backfill'>>;
export type TimelineItem = { memoryId: string; eventAt: string; imageUrl: string; title: string; note: string; mood: string; statuses: string[]; topics: Array<{ id: string; name: string }> };
export type TimelinePage = { items: TimelineItem[]; nextCursor?: string };

export class ApiLongTermCopyRepository {
  constructor(private readonly client: ApiClient) {}

  list() { return this.client.request<LongTermCopy[]>('/api/long-term-copies'); }
  create(input: LongTermCopyInput) { return this.client.request<LongTermCopy>('/api/long-term-copies', { method: 'POST', body: JSON.stringify(input) }); }
  update(id: string, input: LongTermCopyUpdateInput) { return this.client.request<LongTermCopy>(`/api/long-term-copies/${id}`, { method: 'PATCH', body: JSON.stringify(input) }); }
  remove(id: string) { return this.client.request(`/api/long-term-copies/${id}`, { method: 'DELETE' }); }
  backfill(id: string) { return this.client.request<LongTermCopy>(`/api/long-term-copies/${id}/backfill`, { method: 'POST' }); }

  timeline(id: string, params: { cursor?: string; pageSize?: number } = {}) {
    const query = new URLSearchParams();
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    return this.client.request<TimelinePage>(`/api/long-term-copies/${id}/timeline${query.toString() ? `?${query}` : ''}`);
  }
}
