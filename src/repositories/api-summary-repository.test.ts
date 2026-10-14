import { describe, expect, it, vi } from 'vitest';
import { ApiSummaryRepository } from './api-summary-repository';

describe('ApiSummaryRepository', () => {
  it('uses every summary lifecycle endpoint with the expected body', async () => {
    const request = vi.fn(async (path: string) => path.includes('/check') ? { needsConsent: false, due: [], pendingPeriods: [] } : { id: 'summary-1' });
    const repository = new ApiSummaryRepository({ request } as never);

    await repository.checkDue();
    await repository.list('MONTH');
    await repository.getById('summary-1');
    await repository.generate({ periodType: 'MONTH', periodKey: '2026-09' });
    await repository.updateProgress('summary-1', { version: 2, page: 3, viewed: true });
    await repository.updatePage('summary-1', 'page-1', { version: 4, narration: '你走过了很长的路。', displayOrder: 1 });
    await repository.regenerate('summary-1');
    await repository.saveReflection('summary-1', { text: '你会继续向前。', coverMediaId: 'media-1' });
    await repository.remove('summary-1');
    await repository.getPreferences();
    await repository.updatePreferences({ reviewed: true, allowText: true, allowPhotos: false, allowCloudAi: false });

    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/api/summaries/check',
      '/api/summaries?periodType=MONTH',
      '/api/summaries/summary-1',
      '/api/summaries/generate',
      '/api/summaries/summary-1/progress',
      '/api/summaries/summary-1/pages/page-1',
      '/api/summaries/summary-1/regenerate',
      '/api/summaries/summary-1/reflection',
      '/api/summaries/summary-1',
      '/api/summary-preferences',
      '/api/summary-preferences',
    ]);
    expect(request).toHaveBeenNthCalledWith(4, '/api/summaries/generate', { method: 'POST', body: JSON.stringify({ periodType: 'MONTH', periodKey: '2026-09' }) });
    expect(request).toHaveBeenNthCalledWith(5, '/api/summaries/summary-1/progress', { method: 'PATCH', body: JSON.stringify({ version: 2, page: 3, viewed: true }) });
    expect(request).toHaveBeenNthCalledWith(6, '/api/summaries/summary-1/pages/page-1', { method: 'PATCH', body: JSON.stringify({ version: 4, narration: '你走过了很长的路。', displayOrder: 1 }) });
    expect(request).toHaveBeenNthCalledWith(8, '/api/summaries/summary-1/reflection', { method: 'POST', body: JSON.stringify({ text: '你会继续向前。', coverMediaId: 'media-1' }) });
    expect(request).toHaveBeenNthCalledWith(9, '/api/summaries/summary-1', { method: 'DELETE' });
  });
});
