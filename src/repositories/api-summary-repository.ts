import { ApiClient } from '../api/client';
import type {
  DueSummaryResult,
  MemoryStorySummary,
  MemorySummary,
  NoContentSummary,
  StoryPeriodType,
  SummaryListItem,
  SummaryPeriod,
  SummaryPreference,
  SummaryReflection,
  SummaryStoryPage,
} from '../domain/memory-summary';

export type GenerateSummaryRequest = { periodType: StoryPeriodType; periodKey: string };
export type UpdateSummaryProgressRequest = { version: number; page: number; viewed?: boolean };
export type UpdateSummaryPageRequest = { version: number; narration?: string; payload?: Record<string, unknown>; displayOrder?: number };
export type SaveSummaryReflectionRequest = { text: string; coverMediaId?: string };
export type UpdateSummaryPreferenceRequest = Pick<SummaryPreference, 'reviewed'> & Partial<Pick<SummaryPreference, 'enabled' | 'allowText' | 'allowPhotos' | 'allowCloudAi'>>;

export class ApiSummaryRepository {
  constructor(private readonly client: ApiClient) {}

  get(period: SummaryPeriod, date: string): Promise<MemorySummary> {
    return this.client.request<MemorySummary>(`/api/summaries?period=${period}&date=${encodeURIComponent(date)}`);
  }

  checkDue(): Promise<DueSummaryResult> {
    return this.client.request<DueSummaryResult>('/api/summaries/check');
  }

  list(periodType?: StoryPeriodType): Promise<SummaryListItem[]> {
    return this.client.request<SummaryListItem[]>(`/api/summaries${periodType ? `?periodType=${periodType}` : ''}`);
  }

  getById(id: string): Promise<MemoryStorySummary> {
    return this.client.request<MemoryStorySummary>(`/api/summaries/${encodeURIComponent(id)}`);
  }

  generate(input: GenerateSummaryRequest): Promise<MemoryStorySummary | NoContentSummary> {
    return this.client.request('/api/summaries/generate', { method: 'POST', body: JSON.stringify(input) });
  }

  updateProgress(id: string, input: UpdateSummaryProgressRequest): Promise<MemoryStorySummary> {
    return this.client.request(`/api/summaries/${encodeURIComponent(id)}/progress`, { method: 'PATCH', body: JSON.stringify(input) });
  }

  updatePage(summaryId: string, pageId: string, input: UpdateSummaryPageRequest): Promise<SummaryStoryPage> {
    return this.client.request(`/api/summaries/${encodeURIComponent(summaryId)}/pages/${encodeURIComponent(pageId)}`, { method: 'PATCH', body: JSON.stringify(input) });
  }

  regenerate(id: string): Promise<MemoryStorySummary | NoContentSummary> {
    return this.client.request(`/api/summaries/${encodeURIComponent(id)}/regenerate`, { method: 'POST' });
  }

  saveReflection(id: string, input: SaveSummaryReflectionRequest): Promise<SummaryReflection> {
    return this.client.request(`/api/summaries/${encodeURIComponent(id)}/reflection`, { method: 'POST', body: JSON.stringify(input) });
  }

  async remove(id: string): Promise<void> {
    await this.client.request(`/api/summaries/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  getPreferences(): Promise<SummaryPreference> {
    return this.client.request<SummaryPreference>('/api/summary-preferences');
  }

  updatePreferences(input: UpdateSummaryPreferenceRequest): Promise<SummaryPreference> {
    return this.client.request('/api/summary-preferences', { method: 'PATCH', body: JSON.stringify(input) });
  }
}
