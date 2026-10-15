import { Prisma } from '@prisma/client';
import type { MemorySearchCursor } from './memory-search-cursor.js';
import type { MemorySearchInput } from './memory-search.types.js';

export function buildMemorySearchQueries(userId: string, input: MemorySearchInput, cursor?: MemorySearchCursor) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`m."userId" = ${userId}`,
    Prisma.sql`m."deletedAt" IS NULL`,
  ];
  if (input.from) conditions.push(Prisma.sql`m."eventAt" >= ${new Date(input.from)}`);
  if (input.to) conditions.push(Prisma.sql`m."eventAt" < ${new Date(input.to)}`);
  if (input.mood?.trim()) conditions.push(Prisma.sql`m."mood" = ${input.mood.trim()}`);

  const statuses = uniqueValues(input.statusValues);
  if (statuses.length) conditions.push(Prisma.sql`m."statuses" @> ${statuses}::text[]`);
  for (const topicId of uniqueValues(input.topicIds)) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "MemoryTopic" mt
      WHERE mt."memoryId" = m."id" AND mt."topicId" = ${topicId}
    )`);
  }

  const keywords = uniqueValues(input.keywords).map((keyword) => keyword.toLocaleLowerCase());
  const fuzzy = input.matchMode === 'FUZZY';
  const scoreParts: Prisma.Sql[] = [];
  for (const keyword of keywords) {
    if (fuzzy) {
      conditions.push(Prisma.sql`(
        similarity(lower(m."title"), ${keyword}) >= 0.25
        OR similarity(lower(m."note"), ${keyword}) >= 0.25
      )`);
      scoreParts.push(Prisma.sql`GREATEST(
        similarity(lower(m."title"), ${keyword}) * 2,
        similarity(lower(m."note"), ${keyword})
      )`);
    } else {
      const pattern = `%${keyword}%`;
      conditions.push(Prisma.sql`(
        lower(m."title") LIKE ${pattern}
        OR lower(m."note") LIKE ${pattern}
      )`);
      scoreParts.push(Prisma.sql`(
        CASE WHEN lower(m."title") LIKE ${pattern} THEN 2 ELSE 0 END
        + CASE WHEN lower(m."note") LIKE ${pattern} THEN 1 ELSE 0 END
      )`);
    }
  }

  const whereSql = Prisma.join(conditions, ' AND ');
  const scoreSql = scoreParts.length ? Prisma.join(scoreParts, ' + ') : Prisma.sql`0`;
  const cursorSql = buildCursorClause(input, cursor);
  const orderSql = buildOrder(input);

  return {
    rows: Prisma.sql`
      WITH ranked AS (
        SELECT m."id" AS id, m."eventAt" AS "eventAt", (${scoreSql})::double precision AS score
        FROM "Memory" m
        WHERE ${whereSql}
      )
      SELECT id, "eventAt", score
      FROM ranked
      ${cursorSql}
      ORDER BY ${orderSql}
      LIMIT ${6}
    `,
    count: Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "Memory" m
      WHERE ${whereSql}
    `,
  };
}

function buildCursorClause(input: MemorySearchInput, cursor?: MemorySearchCursor) {
  if (!cursor) return Prisma.empty;
  const eventAt = new Date(cursor.eventAt);
  if (input.sort === 'OLDEST') {
    return Prisma.sql`WHERE ("eventAt", id) > (${eventAt}, ${cursor.id})`;
  }
  if (input.sort === 'RELEVANCE' && (input.keywords?.length ?? 0) > 0) {
    return Prisma.sql`WHERE (score, "eventAt", id) < (${cursor.score}, ${eventAt}, ${cursor.id})`;
  }
  return Prisma.sql`WHERE ("eventAt", id) < (${eventAt}, ${cursor.id})`;
}

function buildOrder(input: MemorySearchInput) {
  if (input.sort === 'OLDEST') return Prisma.sql`"eventAt" ASC, id ASC`;
  if (input.sort === 'RELEVANCE' && (input.keywords?.length ?? 0) > 0) {
    return Prisma.sql`score DESC, "eventAt" DESC, id DESC`;
  }
  return Prisma.sql`"eventAt" DESC, id DESC`;
}

function uniqueValues(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}
