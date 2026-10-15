import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { decodeMemorySearchCursor, encodeMemorySearchCursor } from './memory-search-cursor.js';
import { buildMemorySearchQueries } from './memory-search-query.js';
import type {
  MemorySearchInput,
  MemorySearchItem,
  MemorySearchPage,
  MemorySearchRelaxation,
} from './memory-search.types.js';

type RankedMemory = { id: string; eventAt: Date | string; score: number | string };
type CountRow = { count: bigint | number | string };

@Injectable()
export class MemorySearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, input: MemorySearchInput): Promise<MemorySearchPage> {
    const normalizedInput = normalizeMemorySearchInput(input);
    const cursor = normalizedInput.cursor ? decodeMemorySearchCursor(normalizedInput.cursor) : undefined;
    const queries = buildMemorySearchQueries(userId, normalizedInput, cursor);
    const [rankedRows, countRows] = await Promise.all([
      this.prisma.$queryRaw<RankedMemory[]>(queries.rows),
      this.prisma.$queryRaw<CountRow[]>(queries.count),
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    const pageRows = rankedRows.slice(0, 5);
    const items = await this.hydrate(pageRows);
    const hasNext = rankedRows.length > 5;
    const cursorRow = hasNext ? pageRows.at(-1) : undefined;
    const relaxationSuggestions = total === 0 && !normalizedInput.cursor
      ? await this.findRelaxationSuggestions(userId, normalizedInput)
      : [];

    return {
      items,
      total,
      ...(cursorRow ? {
        nextCursor: encodeMemorySearchCursor({
          score: Number(cursorRow.score),
          eventAt: new Date(cursorRow.eventAt).toISOString(),
          id: cursorRow.id,
        }),
      } : {}),
      ...(relaxationSuggestions.length ? { relaxationSuggestions } : {}),
    };
  }

  private async hydrate(rankedRows: RankedMemory[]): Promise<MemorySearchItem[]> {
    if (!rankedRows.length) return [];
    const ids = rankedRows.map((row) => row.id);
    const rows = await this.prisma.memory.findMany({
      where: { id: { in: ids } },
      include: {
        media: true,
        topics: { include: { topic: true } },
        copyLinks: { include: { copy: true } },
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [this.toItem(row)] : [];
    });
  }

  private async findRelaxationSuggestions(userId: string, input: MemorySearchInput): Promise<MemorySearchRelaxation[]> {
    const candidates = buildRelaxationCandidates(input);
    const counts = await Promise.all(candidates.map(async (candidate) => {
      const query = buildMemorySearchQueries(userId, candidate.input).count;
      const rows = await this.prisma.$queryRaw<CountRow[]>(query);
      return { ...candidate.suggestion, resultCount: Number(rows[0]?.count ?? 0) };
    }));
    return counts.filter((candidate) => candidate.resultCount > 0).slice(0, 3);
  }

  private toItem(memory: any): MemorySearchItem {
    const topics = (memory.topics ?? []).map((item: any) => ({
      id: item.topic?.id ?? item.topicId,
      name: item.topic?.name ?? '',
    }));
    const longTermCopies = (memory.copyLinks ?? []).map((item: any) => ({
      id: item.copy?.id ?? item.copyId,
      name: item.copy?.name ?? '',
    }));
    return {
      id: memory.id,
      userId: memory.userId,
      mediaId: memory.mediaId,
      imageUrl: memory.media ? `/api/media/${memory.media.id}/file` : '',
      title: memory.title ?? '',
      note: memory.note ?? '',
      mood: memory.mood ?? '',
      eventAt: memory.eventAt,
      timezone: memory.timezone,
      statuses: memory.statuses ?? [],
      topicIds: topics.map((topic: { id: string }) => topic.id),
      topics,
      longTermCopies,
      echoExcluded: memory.echoExcluded ?? false,
      summaryExcluded: memory.summaryExcluded ?? false,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
  }
}

export function normalizeMemorySearchInput(input: MemorySearchInput): MemorySearchInput {
  const hasKeywords = (input.keywords ?? []).some((keyword) => keyword.trim().length > 0);
  return {
    ...input,
    sort: input.sort ?? (hasKeywords ? 'RELEVANCE' : 'NEWEST'),
    matchMode: input.matchMode ?? 'EXACT',
    pageSize: 5,
  };
}

function buildRelaxationCandidates(input: MemorySearchInput): Array<{
  suggestion: Omit<MemorySearchRelaxation, 'resultCount'>;
  input: MemorySearchInput;
}> {
  const candidates: Array<{ suggestion: Omit<MemorySearchRelaxation, 'resultCount'>; input: MemorySearchInput }> = [];
  const base = { ...input, cursor: undefined };
  if (input.from) candidates.push({ suggestion: { field: 'from', value: input.from }, input: { ...base, from: undefined } });
  if (input.to) candidates.push({ suggestion: { field: 'to', value: input.to }, input: { ...base, to: undefined } });
  if (input.mood) candidates.push({ suggestion: { field: 'mood', value: input.mood }, input: { ...base, mood: undefined } });
  for (const value of uniqueValues(input.statusValues)) {
    candidates.push({
      suggestion: { field: 'status', value },
      input: { ...base, statusValues: input.statusValues?.filter((item) => item !== value) },
    });
  }
  for (const value of uniqueValues(input.topicIds)) {
    candidates.push({
      suggestion: { field: 'topic', value },
      input: { ...base, topicIds: input.topicIds?.filter((item) => item !== value) },
    });
  }
  for (const value of uniqueValues(input.keywords)) {
    candidates.push({
      suggestion: { field: 'keyword', value },
      input: { ...base, keywords: input.keywords?.filter((item) => item !== value) },
    });
  }
  return candidates;
}

function uniqueValues(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}
