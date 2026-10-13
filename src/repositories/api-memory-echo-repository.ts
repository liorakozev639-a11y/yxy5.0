import { ApiClient } from '../api/client';
import type { EchoPreference, EchoPreferenceUpdate, EchoReflection, MemoryEcho } from '../domain/memory-echo';
import { mapApiMemory, type ApiMemory } from './api-memory-repository';

type ApiEcho = Omit<MemoryEcho, 'memory' | 'comparisonMemory'> & {
  memory?: ApiMemory;
  comparisonMemory?: ApiMemory;
};

export class ApiMemoryEchoRepository {
  constructor(private readonly client: ApiClient) {}

  async today(): Promise<MemoryEcho[]> {
    return (await this.client.request<ApiEcho[]>('/api/echoes/today')).map(mapEcho);
  }

  async list(days = 30): Promise<MemoryEcho[]> {
    return (await this.client.request<ApiEcho[]>(`/api/echoes?days=${days}`)).map(mapEcho);
  }

  saveReflection(id: string, text: string) {
    return this.client.request<EchoReflection>(`/api/echoes/${id}/reflection`, { method: 'PUT', body: JSON.stringify({ text }) });
  }

  listReflections(memoryId: string) {
    return this.client.request<EchoReflection[]>(`/api/echoes/reflections/${memoryId}`);
  }

  dismiss(id: string) {
    return this.client.request<{ ok: true }>(`/api/echoes/${id}/dismiss`, { method: 'POST' });
  }

  getPreferences() {
    return this.client.request<EchoPreference>('/api/echoes/preferences/current');
  }

  updatePreferences(input: EchoPreferenceUpdate) {
    return this.client.request<EchoPreference>('/api/echoes/preferences/current', { method: 'PATCH', body: JSON.stringify(input) });
  }

  setMemoryExcluded(id: string, echoExcluded: boolean) {
    return this.client.request(`/api/memories/${id}/echo-setting`, { method: 'PATCH', body: JSON.stringify({ echoExcluded }) });
  }

  setTopicEnabled(id: string, echoEnabled: boolean) {
    return this.client.request(`/api/topics/${id}/echo-setting`, { method: 'PATCH', body: JSON.stringify({ echoEnabled }) });
  }
}

function mapEcho(item: ApiEcho): MemoryEcho {
  const { memory, comparisonMemory, ...echo } = item;
  return {
    ...echo,
    ...(memory ? { memory: mapApiMemory(memory) } : {}),
    ...(comparisonMemory ? { comparisonMemory: mapApiMemory(comparisonMemory) } : {}),
  };
}
