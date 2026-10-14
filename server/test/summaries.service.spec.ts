import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SummariesService } from '../src/summaries/summaries.service.js';
import type { SummarySnapshot } from '../src/summaries/summary-story.types.js';

const snapshot: SummarySnapshot = {
  periodType: 'MONTH',
  periodKey: '2026-09',
  label: '2026年9月',
  range: { start: '2026-08-31T16:00:00.000Z', end: '2026-09-30T16:00:00.000Z' },
  memories: [{
    id: 'memory-1', mediaId: 'media-1', imageUrl: '/api/media/media-1/file', storagePath: 'D:\\private.jpg',
    title: '海边', note: '风很温柔', mood: '开心', eventAt: '2026-09-12T04:00:00.000Z',
    statuses: ['散步'], topics: ['恋爱'], summaryExcluded: false, deletedAt: null,
  }],
  memoryCount: 1,
  photoCount: 1,
  recordedDays: 1,
  topTopics: [{ name: '恋爱', count: 1 }],
  topMoods: [{ name: '开心', count: 1 }],
  topStatuses: [{ name: '散步', count: 1 }],
  longTermCopies: [],
  allowText: true,
  allowPhotos: true,
  sourceHash: 'hash-1',
};

function createHarness(snapshotResult: SummarySnapshot | null = snapshot) {
  const summaries: any[] = [];
  const pages: any[] = [];
  const reflections: any[] = [];
  let nextId = 1;
  const matchSummary = (row: any, where: any) => (!where.id || row.id === where.id)
    && (!where.userId || row.userId === where.userId)
    && (!where.version || row.version === where.version)
    && (!where.status || row.status === where.status)
    && (!where.periodType || row.periodType === where.periodType);
  const applyData = (row: any, data: any) => {
    Object.entries(data).forEach(([key, value]: [string, any]) => {
      if (value && typeof value === 'object' && 'increment' in value) row[key] += value.increment;
      else row[key] = value;
    });
    row.updatedAt = new Date();
    return row;
  };
  const prisma: any = {
    summaryPreference: { findUnique: vi.fn(async () => ({ userId: 'local-user', enabled: true, allowText: true, allowPhotos: true, allowCloudAi: false, consentReviewedAt: new Date() })) },
    memorySummary: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.userId_periodType_periodKey;
        return summaries.find((row) => row.userId === key.userId && row.periodType === key.periodType && row.periodKey === key.periodKey) ?? null;
      }),
      findMany: vi.fn(async ({ where = {} }: any) => summaries.filter((row) => matchSummary(row, where))),
      findFirst: vi.fn(async ({ where = {} }: any) => summaries.find((row) => matchSummary(row, where)) ?? null),
      create: vi.fn(async ({ data }: any) => {
        if (summaries.some((row) => row.userId === data.userId && row.periodType === data.periodType && row.periodKey === data.periodKey)) {
          const error: any = new Error('duplicate'); error.code = 'P2002'; throw error;
        }
        const row = { id: `summary-${nextId++}`, version: 1, viewedAt: null, lastViewedPage: 0, createdAt: new Date(), updatedAt: new Date(), ...data };
        summaries.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => applyData(summaries.find((row) => row.id === where.id), data)),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const matches = summaries.filter((row) => matchSummary(row, where));
        matches.forEach((row) => applyData(row, data));
        return { count: matches.length };
      }),
      delete: vi.fn(async ({ where }: any) => {
        const index = summaries.findIndex((row) => row.id === where.id);
        return summaries.splice(index, 1)[0];
      }),
    },
    memorySummaryPage: {
      createMany: vi.fn(async ({ data }: any) => {
        data.forEach((item: any) => pages.push({ id: `page-${nextId++}`, version: 1, createdAt: new Date(), updatedAt: new Date(), ...item }));
        return { count: data.length };
      }),
      findMany: vi.fn(async ({ where }: any) => pages.filter((page) => page.summaryId === where.summaryId).sort((a, b) => a.displayOrder - b.displayOrder)),
      findFirst: vi.fn(async ({ where }: any) => pages.find((page) => page.id === where.id && (!where.summaryId || page.summaryId === where.summaryId)) ?? null),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const matches = pages.filter((page) => page.id === where.id && (!where.version || page.version === where.version));
        matches.forEach((page) => applyData(page, data));
        return { count: matches.length };
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const kept = pages.filter((page) => page.summaryId !== where.summaryId);
        const count = pages.length - kept.length;
        pages.splice(0, pages.length, ...kept);
        return { count };
      }),
    },
    summaryReflection: {
      findUnique: vi.fn(async ({ where }: any) => reflections.find((item) => item.summaryId === where.summaryId) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        let row = reflections.find((item) => item.summaryId === where.summaryId);
        if (row) Object.assign(row, update, { updatedAt: new Date() });
        else { row = { id: `reflection-${nextId++}`, createdAt: new Date(), updatedAt: new Date(), ...create }; reflections.push(row); }
        return row;
      }),
    },
    mediaAsset: { findFirst: vi.fn(async ({ where }: any) => where.id === 'media-1' ? { id: 'media-1', userId: 'local-user' } : null) },
    $transaction: vi.fn(async (callback: any) => callback(prisma)),
  };
  const snapshotService = { create: vi.fn(async () => snapshotResult) };
  const template = { generate: vi.fn((_snapshot: any, drafts: any[]) => drafts.map((page) => ({ ...page, narration: `你正在回看${page.pageType}` }))) };
  const ai = { generate: vi.fn(async () => ({ ok: false, reason: 'UNAVAILABLE' })) };
  const validation = { validate: vi.fn((value) => value) };
  const service = new SummariesService(prisma, snapshotService as any, template as any, ai as any, validation as any);
  return { service, prisma, summaries, pages, reflections, snapshotService, ai };
}

describe('SummariesService lifecycle', () => {
  it('is idempotent for an already generated period', async () => {
    const harness = createHarness();
    const first = await harness.service.generate('local-user', { periodType: 'MONTH', periodKey: '2026-09' });
    const second = await harness.service.generate('local-user', { periodType: 'MONTH', periodKey: '2026-09' });

    expect(first.id).toBe(second.id);
    expect(harness.prisma.memorySummary.create).toHaveBeenCalledTimes(1);
    expect(harness.snapshotService.create).toHaveBeenCalledTimes(1);
  });

  it('does not persist an empty-period summary and returns an explicit no-content result', async () => {
    const harness = createHarness(null);
    await expect(harness.service.generate('local-user', { periodType: 'MONTH', periodKey: '2026-09' }))
      .resolves.toEqual({ status: 'NO_CONTENT', periodType: 'MONTH', periodKey: '2026-09' });
    expect(harness.summaries).toHaveLength(0);
  });

  it('stores a four-page compact template and never exposes storage paths', async () => {
    const harness = createHarness();
    const result = await harness.service.generate('local-user', { periodType: 'MONTH', periodKey: '2026-09' });

    expect(result).toMatchObject({ status: 'READY', isCompact: true, generationMode: 'TEMPLATE' });
    expect(result.pages).toHaveLength(4);
    expect(JSON.stringify(result)).not.toContain('private.jpg');
    expect(result.pages.find((page: any) => page.pageType === 'MEMORY').payload.memories[0]).toMatchObject({ id: 'memory-1', imageUrl: '/api/media/media-1/file' });
  });

  it('rejects stale optimistic-lock versions for progress and page edits', async () => {
    const harness = createHarness();
    const summary = await harness.service.generate('local-user', { periodType: 'MONTH', periodKey: '2026-09' });
    const page = summary.pages[0];

    await expect(harness.service.updateProgress('local-user', summary.id, { version: 99, page: 2, viewed: true })).rejects.toBeInstanceOf(ConflictException);
    await expect(harness.service.updatePage('local-user', summary.id, page.id, { version: 99, narration: '你修改后的旁白' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('saves a reflection, lists only the owner records, and deletes the summary', async () => {
    const harness = createHarness();
    const summary = await harness.service.generate('local-user', { periodType: 'MONTH', periodKey: '2026-09' });

    await expect(harness.service.saveReflection('local-user', summary.id, { text: '你会继续好好生活。', coverMediaId: 'media-1' }))
      .resolves.toMatchObject({ text: '你会继续好好生活。', coverMediaId: 'media-1' });
    await expect(harness.service.list('local-user', {})).resolves.toHaveLength(1);
    await expect(harness.service.getById('someone-else', summary.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(harness.service.remove('local-user', summary.id)).resolves.toEqual({ ok: true });
    expect(harness.summaries).toHaveLength(0);
  });
});
