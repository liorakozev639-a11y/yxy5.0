import { describe, expect, it, vi } from 'vitest';
import { ENCOURAGEMENT_COPY } from '../src/summaries/summary-copy.js';
import { SummarySnapshotService } from '../src/summaries/summary-snapshot.service.js';

const memoryRows = [
  {
    id: 'memory-1', mediaId: 'media-1', title: '海边散步', note: '风很温柔', mood: '开心',
    eventAt: new Date('2026-02-02T04:00:00.000Z'), statuses: ['散步'], summaryExcluded: false, deletedAt: null,
    media: { id: 'media-1', storagePath: 'D:\\yxy5.0\\data\\uploads\\local-user\\one.jpg' },
    topics: [{ topic: { id: 'topic-love', name: '恋爱', isNone: false } }],
  },
  {
    id: 'memory-2', mediaId: 'media-2', title: '继续学习', note: '完成了一章', mood: '',
    eventAt: new Date('2026-02-03T04:00:00.000Z'), statuses: ['学习'], summaryExcluded: false, deletedAt: null,
    media: { id: 'media-2', storagePath: 'D:\\yxy5.0\\data\\uploads\\local-user\\two.jpg' },
    topics: [{ topic: { id: 'topic-exam', name: '考研', isNone: false } }],
  },
];

function makePrisma(rows = memoryRows) {
  return {
    memory: { findMany: vi.fn(async () => rows) },
    longTermCopy: { findMany: vi.fn(async () => [{ id: 'copy-1', name: '考研', lifecycleStatus: 'ACTIVE', memoryLinks: [{ memoryId: 'memory-2' }] }]) },
    memorySummary: { findMany: vi.fn(async () => [{ sourceSnapshot: { encouragement: ENCOURAGEMENT_COPY[0] } }]) },
  } as any;
}

describe('SummarySnapshotService', () => {
  it('builds a truthful Shanghai-period snapshot and counts copy memories inside the query range', async () => {
    const prisma = makePrisma();
    const service = new SummarySnapshotService(prisma);
    const result = await service.create('local-user', 'MONTH', '2026-02', { allowText: true, allowPhotos: true });

    expect(result).toMatchObject({
      periodType: 'MONTH', periodKey: '2026-02', label: '2026年2月', memoryCount: 2, photoCount: 2, recordedDays: 2,
      topMoods: [{ name: '开心', count: 1 }],
      longTermCopies: [{ id: 'copy-1', name: '考研', lifecycleStatus: 'ACTIVE', memoryCount: 1 }],
    });
    expect(result?.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.memory.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'local-user', deletedAt: null, summaryExcluded: false, eventAt: { gte: new Date('2026-01-31T16:00:00.000Z'), lt: new Date('2026-02-28T16:00:00.000Z') } }),
    }));
  });

  it('removes text and photo references from both snapshot storage and future cloud input when disabled', async () => {
    const service = new SummarySnapshotService(makePrisma());
    const result = await service.create('local-user', 'MONTH', '2026-02', { allowText: false, allowPhotos: false });

    expect(result?.memories[0]).toMatchObject({ title: '', note: '', mood: '开心' });
    expect(result?.memories[0]).not.toHaveProperty('mediaId');
    expect(result?.memories[0]).not.toHaveProperty('imageUrl');
    expect(result?.memories[0]).not.toHaveProperty('storagePath');
    expect(result?.photoCount).toBe(0);
  });

  it('returns null for a period without memories', async () => {
    const service = new SummarySnapshotService(makePrisma([]));
    await expect(service.create('local-user', 'MONTH', '2026-02', { allowText: true, allowPhotos: true })).resolves.toBeNull();
  });

  it('uses a stable non-repeating encouragement when the period has no mood', async () => {
    const rows = memoryRows.map((row) => ({ ...row, mood: '' }));
    const service = new SummarySnapshotService(makePrisma(rows));
    const first = await service.create('local-user', 'MONTH', '2026-02', { allowText: true, allowPhotos: true });
    const second = await service.create('local-user', 'MONTH', '2026-02', { allowText: true, allowPhotos: true });

    expect(first?.encouragement).toBe(second?.encouragement);
    expect(first?.encouragement).not.toBe(ENCOURAGEMENT_COPY[0]);
  });
});
