import { describe, expect, it } from 'vitest';
import { buildAutoCollectCopyInput, findCopyDecisionCandidates } from './long-term-copy-policy';

describe('long-term copy policy', () => {
  const topics = [
    { id: 'none', name: '无', isNone: true },
    { id: 'love', name: '恋爱' },
    { id: 'exam', name: '考研' },
    { id: 'hidden', name: '旅行', suppressLongTermPrompt: true },
  ];

  it('only asks about selected themes that are not already collecting or suppressed', () => {
    const copies = [
      { id: 'copy-love', name: '恋爱', topicId: 'love', startDate: '2026-01-01', lifecycleStatus: 'ACTIVE' as const, autoCollectEnabled: true },
      { id: 'copy-exam', name: '考研', topicId: 'exam', startDate: '2026-01-01', lifecycleStatus: 'PAUSED' as const, autoCollectEnabled: true },
    ];

    expect(findCopyDecisionCandidates(['none', 'love', 'exam', 'hidden'], topics, copies)).toEqual([
      { topic: topics[2], copy: copies[1] },
    ]);
  });

  it('asks about a normal selected theme when no copy exists', () => {
    expect(findCopyDecisionCandidates(['exam'], topics, [])).toEqual([{ topic: topics[2], copy: undefined }]);
  });

  it('starts future automatic collection without importing earlier memories', () => {
    expect(buildAutoCollectCopyInput(topics[2], '2026-10-13T10:00:00.000Z')).toEqual({
      name: '考研',
      topicId: 'exam',
      startDate: '2026-10-13T10:00:00.000Z',
      lifecycleStatus: 'ACTIVE',
      autoCollectEnabled: true,
      backfill: false,
    });
  });
});
