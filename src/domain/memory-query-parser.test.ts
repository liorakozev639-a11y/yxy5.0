import { describe, expect, it } from 'vitest';
import { parseMemorySearchInput } from './memory-query-parser';

const now = new Date('2026-10-15T02:00:00.000Z');
const catalog = {
  moods: ['开心', '平静'],
  statuses: ['学习', '自主学习', '散步'],
  topics: [{ id: 'topic-exam', name: '考研' }, { id: 'topic-grad', name: '读研' }],
};

describe('parseMemorySearchInput', () => {
  it('extracts known labels and keeps only the unknown text for confirmation', () => {
    const parsed = parseMemorySearchInput('找上个月考研时开心的图书馆记录', catalog, now);

    expect(parsed.criteria).toMatchObject({
      from: '2026-08-31T16:00:00.000Z',
      to: '2026-09-30T16:00:00.000Z',
      mood: '开心',
      topicIds: ['topic-exam'],
    });
    expect(parsed.pendingKeywords).toEqual(['图书馆']);
    expect(parsed.recognized.map((item) => item.label)).toEqual(expect.arrayContaining(['上个月', '考研', '开心']));
  });

  it.each([
    ['今天', '2026-10-14T16:00:00.000Z', '2026-10-15T16:00:00.000Z'],
    ['昨天', '2026-10-13T16:00:00.000Z', '2026-10-14T16:00:00.000Z'],
    ['本周', '2026-10-11T16:00:00.000Z', '2026-10-18T16:00:00.000Z'],
    ['上周', '2026-10-04T16:00:00.000Z', '2026-10-11T16:00:00.000Z'],
    ['本月', '2026-09-30T16:00:00.000Z', '2026-10-31T16:00:00.000Z'],
    ['今年', '2025-12-31T16:00:00.000Z', '2026-12-31T16:00:00.000Z'],
    ['去年', '2024-12-31T16:00:00.000Z', '2025-12-31T16:00:00.000Z'],
    ['最近30天', '2026-09-15T16:00:00.000Z', '2026-10-15T16:00:00.000Z'],
  ])('resolves %s in Asia/Shanghai with an exclusive end', (phrase, from, to) => {
    expect(parseMemorySearchInput(phrase, catalog, now).criteria).toMatchObject({ from, to });
  });

  it('parses an explicit month and an inclusive explicit date range', () => {
    expect(parseMemorySearchInput('2026年9月', catalog, now).criteria).toMatchObject({
      from: '2026-08-31T16:00:00.000Z',
      to: '2026-09-30T16:00:00.000Z',
    });
    expect(parseMemorySearchInput('2026年10月1日至2026年10月15日', catalog, now).criteria).toMatchObject({
      from: '2026-09-30T16:00:00.000Z',
      to: '2026-10-15T16:00:00.000Z',
    });
  });

  it('prefers the longest overlapping custom label', () => {
    const parsed = parseMemorySearchInput('自主学习后的操场', catalog, now);
    expect(parsed.criteria.statusValues).toEqual(['自主学习']);
    expect(parsed.pendingKeywords).toEqual(['操场']);
  });

  it('keeps whitespace-separated unknown text as independent AND keywords', () => {
    const parsed = parseMemorySearchInput('上个月 海边 日落', catalog, now);
    expect(parsed.pendingKeywords).toEqual(['海边', '日落']);
  });

  it('rejects more than five inferred keywords before confirmation', () => {
    expect(() => parseMemorySearchInput('一 二 三 四 五 六', catalog, now)).toThrow('最多添加5个关键词');
  });

  it.each(['2026年2月30日', '2026年13月', '2026年10月15日至2026年10月1日'])(
    'rejects an impossible or reversed explicit date: %s',
    (phrase) => {
      expect(() => parseMemorySearchInput(phrase, catalog, now)).toThrow('日期');
    },
  );

  it('does not guess unsupported seasons or vague time expressions', () => {
    expect(parseMemorySearchInput('去年秋天那段时间的晚霞', catalog, now)).toMatchObject({
      criteria: { from: '2024-12-31T16:00:00.000Z', to: '2025-12-31T16:00:00.000Z' },
      pendingKeywords: ['秋天那段时间晚霞'],
    });
  });

  it('rejects natural-language input longer than one hundred characters', () => {
    expect(() => parseMemorySearchInput('回'.repeat(101), catalog, now)).toThrow('搜索文字不能超过100个字符');
  });
});
