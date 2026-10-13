import { ApiClient } from '../api/client';
import type { MemorySummary, SummaryPeriod } from '../domain/memory-summary';

export class ApiSummaryRepository {
  constructor(private readonly client: ApiClient) {}

  get(period: SummaryPeriod, date: string): Promise<MemorySummary> {
    return this.client.request<MemorySummary>(`/api/summaries?period=${period}&date=${encodeURIComponent(date)}`);
  }
}
