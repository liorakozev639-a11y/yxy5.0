export type EchoTypeValue =
  | 'ON_THIS_DAY'
  | 'COPY_ANNIVERSARY'
  | 'COPY_MILESTONE'
  | 'COPY_FIRST'
  | 'PAST_AND_NOW'
  | 'TOPIC_MEMORY';

export type EchoCopyContext = {
  copyId: string;
  copyName: string;
  topicId: string;
  startDate: Date;
  firstMemoryId?: string;
  latestMemoryId?: string;
};

export type EchoCandidate = {
  memoryId: string;
  eventAt: Date;
  mood: string;
  topicIds: string[];
  echoExcluded?: boolean;
  copies: EchoCopyContext[];
};

export type RankEchoInput = {
  candidates: EchoCandidate[];
  today: Date;
  recentlyShownMemoryIds: string[];
  excludedMoods: string[];
  disabledTopicIds: string[];
};

export type RankedEcho = {
  memoryId: string;
  comparisonMemoryId?: string;
  longTermCopyId?: string;
  topicId?: string;
  type: EchoTypeValue;
  reason: string;
  score: number;
  eventAt: Date;
};

type DateParts = { year: number; month: number; day: number };

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function toShanghaiDateKey(value: Date): string {
  const { year, month, day } = toShanghaiParts(value);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysBetweenShanghai(from: Date, to: Date): number {
  const start = toShanghaiParts(from);
  const finish = toShanghaiParts(to);
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const finishUtc = Date.UTC(finish.year, finish.month - 1, finish.day);
  return Math.floor((finishUtc - startUtc) / 86_400_000);
}

export function rankEchoCandidates(input: RankEchoInput): RankedEcho[] {
  const recent = new Set(input.recentlyShownMemoryIds);
  const moods = new Set(input.excludedMoods);
  const disabledTopics = new Set(input.disabledTopicIds);

  const ranked = input.candidates
    .filter((item) => daysBetweenShanghai(item.eventAt, input.today) >= 30)
    .filter((item) => !item.echoExcluded && !recent.has(item.memoryId) && !moods.has(item.mood))
    .filter((item) => item.topicIds.length === 0 || item.topicIds.some((topicId) => !disabledTopics.has(topicId)))
    .map((item) => classifyEcho(item, input.today, disabledTopics))
    .filter((item): item is RankedEcho => Boolean(item))
    .sort(compareRankedEchoes);

  const copyEventKeys = new Set<string>();
  const deduplicated = ranked.filter((item) => {
    if (!item.longTermCopyId || !['COPY_ANNIVERSARY', 'COPY_MILESTONE'].includes(item.type)) return true;
    const key = `${item.longTermCopyId}:${item.type}`;
    if (copyEventKeys.has(key)) return false;
    copyEventKeys.add(key);
    return true;
  });

  const selected: RankedEcho[] = [];
  const selectedIds = new Set<string>();
  const usedTopics = new Set<string>();

  for (const item of deduplicated) {
    const topicKey = item.topicId ?? `memory:${item.memoryId}`;
    if (usedTopics.has(topicKey)) continue;
    selected.push(item);
    selectedIds.add(item.memoryId);
    usedTopics.add(topicKey);
    if (selected.length === 3) return selected;
  }

  for (const item of deduplicated) {
    if (selectedIds.has(item.memoryId)) continue;
    selected.push(item);
    selectedIds.add(item.memoryId);
    if (selected.length === 3) break;
  }

  return selected;
}

function classifyEcho(candidate: EchoCandidate, today: Date, disabledTopics: Set<string>): RankedEcho | undefined {
  const matches: RankedEcho[] = [];
  const event = toShanghaiParts(candidate.eventAt);
  const current = toShanghaiParts(today);
  const enabledTopicId = candidate.topicIds.find((topicId) => !disabledTopics.has(topicId));
  const yearDifference = current.year - event.year;

  if (yearDifference >= 1 && event.month === current.month && event.day === current.day) {
    matches.push(baseMatch(candidate, enabledTopicId, 'ON_THIS_DAY', `${yearDifference}年前的今天`, 100));
  }

  for (const copy of candidate.copies.filter((item) => !disabledTopics.has(item.topicId))) {
    const copyStart = toShanghaiParts(copy.startDate);
    const copyYears = current.year - copyStart.year;
    const copyDays = daysBetweenShanghai(copy.startDate, today);

    if (copyYears >= 1 && copyStart.month === current.month && copyStart.day === current.day) {
      matches.push(copyMatch(candidate, copy, 'COPY_ANNIVERSARY', `“${copy.copyName}”已经走过${copyYears}年`, 95));
    }
    if ([30, 100, 365].includes(copyDays)) {
      matches.push(copyMatch(candidate, copy, 'COPY_MILESTONE', `“${copy.copyName}”来到第${copyDays}天`, 90));
    }
    if (copy.firstMemoryId === candidate.memoryId) {
      matches.push(copyMatch(candidate, copy, 'COPY_FIRST', `这是“${copy.copyName}”的第一段记忆`, 80));
    }
    if (copy.latestMemoryId === candidate.memoryId && copy.firstMemoryId && copy.firstMemoryId !== candidate.memoryId) {
      matches.push({
        ...copyMatch(candidate, copy, 'PAST_AND_NOW', `看看“${copy.copyName}”的那时与现在`, 75),
        comparisonMemoryId: copy.firstMemoryId,
      });
    }
  }

  matches.push(baseMatch(candidate, enabledTopicId, 'TOPIC_MEMORY', '一段值得重温的旧记忆', 50));
  return matches.sort(compareRankedEchoes)[0];
}

function baseMatch(candidate: EchoCandidate, topicId: string | undefined, type: EchoTypeValue, reason: string, score: number): RankedEcho {
  return { memoryId: candidate.memoryId, topicId, type, reason, score, eventAt: candidate.eventAt };
}

function copyMatch(candidate: EchoCandidate, copy: EchoCopyContext, type: EchoTypeValue, reason: string, score: number): RankedEcho {
  return { ...baseMatch(candidate, copy.topicId, type, reason, score), longTermCopyId: copy.copyId };
}

function compareRankedEchoes(left: RankedEcho, right: RankedEcho) {
  if (right.score !== left.score) return right.score - left.score;
  const timeDifference = left.eventAt.getTime() - right.eventAt.getTime();
  return timeDifference || left.memoryId.localeCompare(right.memoryId);
}

function toShanghaiParts(value: Date): DateParts {
  const parts = Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}
