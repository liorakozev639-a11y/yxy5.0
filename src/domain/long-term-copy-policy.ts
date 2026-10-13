import type { Topic } from './topic';
import type { LongTermCopy } from '../repositories/api-long-term-copy-repository';

export type CopyDecisionCandidate = {
  topic: Topic;
  copy?: LongTermCopy;
};

export function buildAutoCollectCopyInput(topic: Topic, eventAt: string) {
  return {
    name: topic.name,
    topicId: topic.id,
    startDate: eventAt,
    lifecycleStatus: 'ACTIVE' as const,
    autoCollectEnabled: true,
    backfill: false,
  };
}

export function findCopyDecisionCandidates(
  topicIds: string[],
  topics: Topic[],
  copies: LongTermCopy[],
): CopyDecisionCandidate[] {
  const selectedIds = new Set(topicIds);
  return topics
    .filter((topic) => selectedIds.has(topic.id) && !topic.isNone && !topic.suppressLongTermPrompt)
    .map((topic) => ({ topic, copy: copies.find((copy) => copy.topicId === topic.id) }))
    .filter(({ copy }) => !copy || copy.lifecycleStatus !== 'ACTIVE' || !copy.autoCollectEnabled);
}
