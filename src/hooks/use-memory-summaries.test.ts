import { describe, expect, it, vi } from 'vitest';
import { confirmSummaryConsent, initializeSummaryFlow } from './use-memory-summaries';

describe('memory summary orchestration', () => {
  it('checks once after access is ready and opens consent before generation', async () => {
    const repository = {
      checkDue: vi.fn(async () => ({ needsConsent: true, due: [], pendingPeriods: [{ periodType: 'MONTH', periodKey: '2026-09', label: '2026年9月' }] })),
      getPreferences: vi.fn(async () => ({ enabled: true, allowText: true, allowPhotos: true, allowCloudAi: false, reviewed: false })),
    };

    const result = await initializeSummaryFlow(repository as never);

    expect(repository.checkDue).toHaveBeenCalledOnce();
    expect(repository.getPreferences).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ consentOpen: true, reminderDismissed: false, dueResult: { needsConsent: true } });
  });

  it('saves explicit authorization before checking and generating due periods', async () => {
    const calls: string[] = [];
    const repository = {
      updatePreferences: vi.fn(async (input) => { calls.push('preference'); return { ...input, enabled: true }; }),
      checkDue: vi.fn(async () => { calls.push('check'); return { needsConsent: false, due: [], pendingPeriods: [] }; }),
    };

    const result = await confirmSummaryConsent(repository as never, { reviewed: true, allowText: false, allowPhotos: true, allowCloudAi: false });

    expect(calls).toEqual(['preference', 'check']);
    expect(repository.updatePreferences).toHaveBeenCalledWith({ reviewed: true, allowText: false, allowPhotos: true, allowCloudAi: false });
    expect(result).toMatchObject({ consentOpen: false, dueResult: { needsConsent: false } });
  });
});
