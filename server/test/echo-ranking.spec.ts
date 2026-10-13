import { describe, expect, it } from 'vitest';
import { rankEchoCandidates, type EchoCandidate, type RankEchoInput } from '../src/echoes/echo-ranking.js';

const today = new Date('2026-10-13T04:00:00.000Z');

function candidate(overrides: Partial<EchoCandidate> = {}): EchoCandidate {
  return {
    memoryId: 'memory-1',
    eventAt: new Date('2024-06-01T04:00:00.000Z'),
    mood: '平静',
    topicIds: ['topic-a'],
    copies: [],
    ...overrides,
  };
}

function input(candidates: EchoCandidate[], overrides: Partial<RankEchoInput> = {}): RankEchoInput {
  return {
    candidates,
    today,
    recentlyShownMemoryIds: [],
    excludedMoods: [],
    disabledTopicIds: [],
    ...overrides,
  };
}

describe('rankEchoCandidates', () => {
  it('gives the highest score to an on-this-day memory', () => {
    const result = rankEchoCandidates(input([candidate({ eventAt: new Date('2023-10-13T08:00:00.000Z') })]));
    expect(result[0]).toMatchObject({ type: 'ON_THIS_DAY', score: 100, reason: '3年前的今天' });
  });

  it('recognizes copy anniversaries and milestones', () => {
    const anniversary = candidate({
      copies: [{ copyId: 'copy-a', copyName: '恋爱', topicId: 'topic-a', startDate: new Date('2024-10-13T00:00:00.000Z'), firstMemoryId: 'first', latestMemoryId: 'latest' }],
    });
    const milestoneToday = new Date('2026-04-11T04:00:00.000Z');
    const milestone = candidate({
      copies: [{ copyId: 'copy-b', copyName: '考研', topicId: 'topic-a', startDate: new Date('2026-01-01T04:00:00.000Z'), firstMemoryId: 'first', latestMemoryId: 'latest' }],
      eventAt: new Date('2025-01-01T04:00:00.000Z'),
    });

    expect(rankEchoCandidates(input([anniversary]))[0]).toMatchObject({ type: 'COPY_ANNIVERSARY', score: 95 });
    expect(rankEchoCandidates(input([milestone], { today: milestoneToday }))[0]).toMatchObject({ type: 'COPY_MILESTONE', score: 90, reason: '“考研”来到第100天' });
  });

  it('recognizes the first copy memory and a past-versus-now pair', () => {
    const copy = { copyId: 'copy-a', copyName: '读研', topicId: 'topic-a', startDate: new Date('2024-01-01T00:00:00.000Z'), firstMemoryId: 'first', latestMemoryId: 'latest' };
    const first = candidate({ memoryId: 'first', eventAt: new Date('2024-01-03T00:00:00.000Z'), copies: [copy] });
    const latest = candidate({ memoryId: 'latest', eventAt: new Date('2025-08-01T00:00:00.000Z'), copies: [copy] });

    expect(rankEchoCandidates(input([first]))[0]).toMatchObject({ type: 'COPY_FIRST', score: 80, longTermCopyId: 'copy-a' });
    expect(rankEchoCandidates(input([latest]))[0]).toMatchObject({ type: 'PAST_AND_NOW', score: 75, comparisonMemoryId: 'first' });
  });

  it('keeps only the highest match for one memory', () => {
    const multiMatch = candidate({
      eventAt: new Date('2023-10-13T00:00:00.000Z'),
      memoryId: 'first',
      copies: [{ copyId: 'copy-a', copyName: '恋爱', topicId: 'topic-a', startDate: new Date('2023-10-13T00:00:00.000Z'), firstMemoryId: 'first', latestMemoryId: 'latest' }],
    });
    expect(rankEchoCandidates(input([multiMatch]))).toEqual([
      expect.objectContaining({ memoryId: 'first', type: 'ON_THIS_DAY', score: 100 }),
    ]);
  });

  it('filters recent, repeated, excluded, mood-blocked and disabled-topic memories', () => {
    const base = candidate();
    expect(rankEchoCandidates(input([{ ...base, eventAt: new Date('2026-09-14T00:00:00.000Z') }]))).toEqual([]);
    expect(rankEchoCandidates(input([base], { recentlyShownMemoryIds: ['memory-1'] }))).toEqual([]);
    expect(rankEchoCandidates(input([{ ...base, echoExcluded: true }]))).toEqual([]);
    expect(rankEchoCandidates(input([base], { excludedMoods: ['平静'] }))).toEqual([]);
    expect(rankEchoCandidates(input([base], { disabledTopicIds: ['topic-a'] }))).toEqual([]);
  });

  it('handles leap day without treating February 28 as the same day', () => {
    const leapMemory = candidate({ eventAt: new Date('2024-02-29T04:00:00.000Z') });
    const nonLeapToday = new Date('2025-02-28T04:00:00.000Z');
    const leapToday = new Date('2028-02-29T04:00:00.000Z');

    expect(rankEchoCandidates(input([leapMemory], { today: nonLeapToday }))[0]?.type).not.toBe('ON_THIS_DAY');
    expect(rankEchoCandidates(input([leapMemory], { today: leapToday }))[0]).toMatchObject({ type: 'ON_THIS_DAY', score: 100 });
  });

  it('prefers different topics before filling with repeated topics', () => {
    const candidates = [
      candidate({ memoryId: 'a1', topicIds: ['topic-a'], eventAt: new Date('2023-10-13T00:00:00.000Z') }),
      candidate({ memoryId: 'a2', topicIds: ['topic-a'], eventAt: new Date('2022-10-13T00:00:00.000Z') }),
      candidate({ memoryId: 'b1', topicIds: ['topic-b'], eventAt: new Date('2024-05-01T00:00:00.000Z') }),
      candidate({ memoryId: 'c1', topicIds: ['topic-c'], eventAt: new Date('2024-04-01T00:00:00.000Z') }),
    ];

    expect(rankEchoCandidates(input(candidates)).map((item) => item.topicId)).toEqual(['topic-a', 'topic-c', 'topic-b']);
  });

  it('returns fewer than three results when quality candidates are insufficient', () => {
    expect(rankEchoCandidates(input([candidate()]))).toHaveLength(1);
  });

  it('keeps only one anniversary or milestone card for the same long-term copy', () => {
    const sharedCopy = { copyId: 'copy-a', copyName: '恋爱', topicId: 'topic-a', startDate: new Date('2025-10-13T04:00:00.000Z') };
    const results = rankEchoCandidates(input([
      candidate({ memoryId: 'memory-a', eventAt: new Date('2024-01-01T04:00:00.000Z'), copies: [sharedCopy] }),
      candidate({ memoryId: 'memory-b', eventAt: new Date('2024-02-01T04:00:00.000Z'), copies: [sharedCopy] }),
      candidate({ memoryId: 'memory-c', eventAt: new Date('2024-03-01T04:00:00.000Z'), copies: [sharedCopy] }),
    ]));
    expect(results.filter((item) => item.type === 'COPY_ANNIVERSARY' && item.longTermCopyId === 'copy-a')).toHaveLength(1);
  });
});
