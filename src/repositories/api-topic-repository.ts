import { ApiClient } from '../api/client';
import type { Topic } from '../domain/topic';

export class ApiTopicRepository {
  constructor(private readonly client: ApiClient) {}

  list() { return this.client.request<Topic[]>('/api/topics'); }

  create(name: string) { return this.client.request<Topic>('/api/topics', { method: 'POST', body: JSON.stringify({ name }) }); }

  update(id: string, input: Partial<Pick<Topic, 'name' | 'color' | 'icon' | 'suppressLongTermPrompt' | 'echoEnabled'>>) {
    return this.client.request<Topic>(`/api/topics/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  }
}
