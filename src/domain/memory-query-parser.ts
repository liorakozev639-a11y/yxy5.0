import {
  normalizeMemorySearchCriteria,
  type MemorySearchCriteria,
  type ParsedMemorySearch,
  type SearchCatalog,
} from './memory-search';

const SHANGHAI_OFFSET_HOURS = 8;

export function parseMemorySearchInput(input: string, catalog: SearchCatalog, now: Date): ParsedMemorySearch {
  const source = input.trim();
  if (source.length > 100) throw new Error('搜索文字不能超过100个字符');

  let remainder = source;
  const criteria: MemorySearchCriteria = {};
  const recognized: ParsedMemorySearch['recognized'] = [];
  const time = extractTime(remainder, now);
  if (time) {
    criteria.from = time.from;
    criteria.to = time.to;
    recognized.push({ type: 'time', label: time.label });
    remainder = replaceOnce(remainder, time.matched);
  }

  const labels = [
    ...catalog.topics.map((topic) => ({ type: 'topic' as const, name: topic.name, id: topic.id })),
    ...catalog.moods.map((name) => ({ type: 'mood' as const, name })),
    ...catalog.statuses.map((name) => ({ type: 'status' as const, name })),
  ].sort((left, right) => right.name.length - left.name.length);

  const statusValues: string[] = [];
  const topicIds: string[] = [];
  for (const label of labels) {
    if (!label.name || !remainder.includes(label.name)) continue;
    remainder = replaceOnce(remainder, label.name);
    recognized.push({ type: label.type, label: label.name });
    if (label.type === 'mood' && !criteria.mood) criteria.mood = label.name;
    if (label.type === 'status') statusValues.push(label.name);
    if (label.type === 'topic' && label.id) topicIds.push(label.id);
  }
  if (statusValues.length) criteria.statusValues = statusValues;
  if (topicIds.length) criteria.topicIds = topicIds;

  const pending = cleanupRemainder(remainder);
  const pendingKeywords = pending ? pending.split(/\s+/u).filter(Boolean) : [];
  normalizeMemorySearchCriteria({ keywords: pendingKeywords });
  return {
    criteria: normalizeMemorySearchCriteria(criteria),
    pendingKeywords,
    recognized,
  };
}

type TimeMatch = { matched: string; label: string; from: string; to: string };

function extractTime(input: string, now: Date): TimeMatch | undefined {
  const range = input.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?\s*(?:至|到|—|-)\s*(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (range) {
    const start = strictLocalDate(Number(range[1]), Number(range[2]), Number(range[3]));
    const endDate = strictLocalDate(Number(range[4]), Number(range[5]), Number(range[6]));
    if (start.getTime() > endDate.getTime()) throw new Error('日期范围的开始日期不能晚于结束日期');
    const end = addDays(endDate, 1);
    return timeMatch(range[0], start, end);
  }

  const exactDate = input.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (exactDate) {
    const start = strictLocalDate(Number(exactDate[1]), Number(exactDate[2]), Number(exactDate[3]));
    return timeMatch(exactDate[0], start, addDays(start, 1));
  }

  const exactMonth = input.match(/(\d{4})年(\d{1,2})月/);
  if (exactMonth) {
    const year = Number(exactMonth[1]);
    const month = Number(exactMonth[2]);
    const start = strictLocalDate(year, month, 1);
    return timeMatch(exactMonth[0], start, localDate(year, month + 1, 1));
  }

  const recent = input.match(/最近\s*(\d{1,3})\s*天/);
  if (recent) {
    const days = Math.max(1, Number(recent[1]));
    const today = todayInShanghai(now);
    return timeMatch(recent[0], addDays(today, -(days - 1)), addDays(today, 1));
  }

  const today = todayInShanghai(now);
  const relative: Array<[string, () => [Date, Date]]> = [
    ['上个月', () => {
      const parts = shanghaiParts(now);
      return [localDate(parts.year, parts.month - 1, 1), localDate(parts.year, parts.month, 1)];
    }],
    ['本月', () => {
      const parts = shanghaiParts(now);
      return [localDate(parts.year, parts.month, 1), localDate(parts.year, parts.month + 1, 1)];
    }],
    ['去年', () => {
      const parts = shanghaiParts(now);
      return [localDate(parts.year - 1, 1, 1), localDate(parts.year, 1, 1)];
    }],
    ['今年', () => {
      const parts = shanghaiParts(now);
      return [localDate(parts.year, 1, 1), localDate(parts.year + 1, 1, 1)];
    }],
    ['上周', () => {
      const monday = startOfShanghaiWeek(today);
      return [addDays(monday, -7), monday];
    }],
    ['本周', () => {
      const monday = startOfShanghaiWeek(today);
      return [monday, addDays(monday, 7)];
    }],
    ['昨天', () => [addDays(today, -1), today]],
    ['今天', () => [today, addDays(today, 1)]],
  ];
  for (const [phrase, rangeFactory] of relative) {
    if (!input.includes(phrase)) continue;
    const [from, to] = rangeFactory();
    return timeMatch(phrase, from, to);
  }
  return undefined;
}

function timeMatch(label: string, from: Date, to: Date): TimeMatch {
  return { matched: label, label, from: from.toISOString(), to: to.toISOString() };
}

function shanghaiParts(value: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(value);
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: number('year'), month: number('month'), day: number('day') };
}

function todayInShanghai(now: Date): Date {
  const parts = shanghaiParts(now);
  return localDate(parts.year, parts.month, parts.day);
}

function localDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, -SHANGHAI_OFFSET_HOURS));
}

function strictLocalDate(year: number, month: number, day: number): Date {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error('日期格式无效，请检查年月日');
  }
  const value = localDate(year, month, day);
  const parts = shanghaiParts(value);
  if (parts.year !== year || parts.month !== month || parts.day !== day) throw new Error('日期不存在，请重新输入');
  return value;
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfShanghaiWeek(today: Date): Date {
  const localMarker = new Date(today.getTime() + SHANGHAI_OFFSET_HOURS * 60 * 60 * 1000);
  const weekday = localMarker.getUTCDay();
  return addDays(today, -(weekday === 0 ? 6 : weekday - 1));
}

function replaceOnce(value: string, matched: string): string {
  const index = value.indexOf(matched);
  return index < 0 ? value : `${value.slice(0, index)} ${value.slice(index + matched.length)}`;
}

function cleanupRemainder(value: string): string {
  return value
    .replace(/[，。！？、,.!?；;：:（）()【】\[\]]/g, ' ')
    .replace(/^\s*(?:请)?(?:帮我)?(?:找|找到|查找|看看|查看)\s*/u, '')
    .replace(/\s*(?:记录|记忆|照片)\s*$/u, '')
    .replace(/^\s*(?:时|期间|后|里|中)+/u, '')
    .replace(/的/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
