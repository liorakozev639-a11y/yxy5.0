import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { MemoriesController } from '../src/memories/memories.controller.js';
import { MemoriesService } from '../src/memories/memories.service.js';
import { SummariesController, SummaryPreferencesController } from '../src/summaries/summaries.controller.js';
import { SummariesService } from '../src/summaries/summaries.service.js';

async function createApp() {
  const summaries = {
    checkDue: vi.fn(async () => ({ needsConsent: false, due: [{ id: 'summary-1', periodKey: '2026-09' }] })),
    generate: vi.fn(async (_userId, input) => ({ id: 'summary-1', status: 'READY', ...input })),
    list: vi.fn(async () => [{ id: 'summary-1', periodKey: '2026-09' }]),
    getById: vi.fn(async (_userId, id) => ({ id, pages: [] })),
    updateProgress: vi.fn(async (_userId, id, input) => ({ id, version: input.version + 1, lastViewedPage: input.page })),
    updatePage: vi.fn(async (_userId, _summaryId, pageId, input) => ({ id: pageId, version: input.version + 1, narration: input.narration })),
    regenerate: vi.fn(async (_userId, id) => ({ id, status: 'READY', regenerated: true })),
    saveReflection: vi.fn(async (_userId, summaryId, input) => ({ summaryId, ...input })),
    remove: vi.fn(async () => ({ ok: true })),
    getPreferences: vi.fn(async () => ({ enabled: true, reviewed: true })),
    updatePreferences: vi.fn(async (_userId, input) => input),
    get: vi.fn(),
  };
  const memories = { setSummaryExcluded: vi.fn(async (_userId, id, value) => ({ id, summaryExcluded: value })) };
  const moduleRef = await Test.createTestingModule({
    controllers: [SummariesController, SummaryPreferencesController, MemoriesController],
    providers: [
      { provide: SummariesService, useValue: summaries },
      { provide: MemoriesService, useValue: memories },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return { app, summaries, memories };
}

describe('emotional summary API', () => {
  it('exposes the complete summary lifecycle', async () => {
    const { app, summaries } = await createApp();
    await request(app.getHttpServer()).get('/api/summaries/check').expect(200);
    await request(app.getHttpServer()).post('/api/summaries/generate').send({ periodType: 'MONTH', periodKey: '2026-09' }).expect(201);
    await request(app.getHttpServer()).get('/api/summaries?periodType=MONTH').expect(200);
    await request(app.getHttpServer()).get('/api/summaries/summary-1').expect(200);
    await request(app.getHttpServer()).patch('/api/summaries/summary-1/progress').send({ version: 1, page: 2, viewed: true }).expect(200);
    await request(app.getHttpServer()).patch('/api/summaries/summary-1/pages/page-1').send({ version: 1, narration: '你修改后的旁白' }).expect(200);
    await request(app.getHttpServer()).post('/api/summaries/summary-1/regenerate').expect(201);
    await request(app.getHttpServer()).post('/api/summaries/summary-1/reflection').send({ text: '你会继续认真生活。', coverMediaId: 'media-1' }).expect(201);
    await request(app.getHttpServer()).delete('/api/summaries/summary-1').expect(200);

    expect(summaries.generate).toHaveBeenCalledWith('local-user', { periodType: 'MONTH', periodKey: '2026-09' });
    expect(summaries.updatePage).toHaveBeenCalledWith('local-user', 'summary-1', 'page-1', expect.objectContaining({ version: 1 }));
    await app.close();
  });

  it('validates period keys and allows per-memory summary exclusion', async () => {
    const { app, memories } = await createApp();
    await request(app.getHttpServer()).post('/api/summaries/generate').send({ periodType: 'MONTH', periodKey: '2026' }).expect(400);
    await request(app.getHttpServer()).patch('/api/memories/memory-1/summary-setting').send({ summaryExcluded: true }).expect(200);
    expect(memories.setSummaryExcluded).toHaveBeenCalledWith('local-user', 'memory-1', true);
    await app.close();
  });
});
