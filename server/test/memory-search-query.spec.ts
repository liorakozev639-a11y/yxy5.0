import { describe, expect, it } from 'vitest';
import { buildMemorySearchQueries } from '../src/memories/memory-search-query.js';

function inspect(query: { strings: readonly string[]; values: readonly unknown[] }) {
  return { text: query.strings.join('?'), values: [...query.values] };
}

describe('memory search SQL builder', () => {
  it('requires every exact keyword and ranks title matches above note matches', () => {
    const { rows } = buildMemorySearchQueries('local-user', {
      keywords: ['海边', '日落'],
      matchMode: 'EXACT',
      sort: 'RELEVANCE',
      pageSize: 5,
    });
    const query = inspect(rows as any);

    expect(query.text).toContain('CASE WHEN lower(m."title") LIKE');
    expect(query.text).toContain('THEN 2');
    expect(query.text).toContain('CASE WHEN lower(m."note") LIKE');
    expect(query.text).toContain('THEN 1');
    expect(query.text.match(/lower\(m\."title"\) LIKE/g)).toHaveLength(4);
    expect(query.text).toMatch(/\)\s+AND\s+\(\s+lower\(m\."title"\) LIKE/);
    expect(query.values).toContain('%海边%');
    expect(query.values).toContain('%日落%');
  });

  it('uses trigram similarity only in explicitly confirmed fuzzy mode', () => {
    const exact = inspect(buildMemorySearchQueries('local-user', { keywords: ['海岸'], matchMode: 'EXACT', pageSize: 5 }).rows as any);
    const fuzzy = inspect(buildMemorySearchQueries('local-user', { keywords: ['海岸'], matchMode: 'FUZZY', pageSize: 5 }).rows as any);

    expect(exact.text).not.toContain('similarity(');
    expect(fuzzy.text).toContain('similarity(lower(m."title")');
    expect(fuzzy.text).toContain('similarity(lower(m."note")');
  });

  it('keeps user input in bound values and never interpolates it into SQL text', () => {
    const malicious = "海边%' OR TRUE --";
    const query = inspect(buildMemorySearchQueries('local-user', { keywords: [malicious], pageSize: 5 }).rows as any);

    expect(query.text).not.toContain(malicious);
    expect(query.values).toContain(`%${malicious.toLocaleLowerCase()}%`);
  });

  it('orders relevance pages by score, event time and id and applies the full cursor tuple', () => {
    const query = inspect(buildMemorySearchQueries(
      'local-user',
      { keywords: ['海边'], sort: 'RELEVANCE', pageSize: 5 },
      { score: 2, eventAt: '2026-10-15T08:30:00.000Z', id: 'memory-a' },
    ).rows as any);

    expect(query.text).toContain('score DESC, "eventAt" DESC, id DESC');
    expect(query.text).toContain('(score, "eventAt", id) <');
    expect(query.values).toEqual(expect.arrayContaining([2, new Date('2026-10-15T08:30:00.000Z'), 'memory-a', 6]));
  });
});
