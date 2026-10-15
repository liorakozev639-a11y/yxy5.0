import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('memories API', () => {
  it('returns an empty memory page for the local user', async () => {
    const fakePrisma = {
      appLockSetting: { findUnique: vi.fn(async () => null) },
      memory: { findMany: vi.fn(async () => []) },
      $connect: vi.fn(),
      $disconnect: vi.fn(),
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const response = await request(app.getHttpServer()).get('/api/memories').expect(200);
    expect(response.body).toEqual({ items: [] });
    await app.close();
  });

  it('updates the per-memory summary exclusion setting', async () => {
    const fakePrisma = {
      appLockSetting: { findUnique: vi.fn(async () => null) },
      memory: {
        findFirst: vi.fn(async () => ({ id: 'memory-1', userId: 'local-user', deletedAt: null })),
        update: vi.fn(async ({ data }: any) => ({ id: 'memory-1', ...data })),
      },
      $connect: vi.fn(),
      $disconnect: vi.fn(),
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const response = await request(app.getHttpServer())
      .patch('/api/memories/memory-1/summary-setting')
      .send({ summaryExcluded: true })
      .expect(200);
    expect(response.body).toMatchObject({ id: 'memory-1', summaryExcluded: true });
    await app.close();
  });

  it('searches memories through the dedicated exact-search endpoint', async () => {
    const row = {
      id: 'memory-1',
      userId: 'local-user',
      mediaId: 'media-1',
      title: '海边日落',
      note: '',
      mood: '开心',
      eventAt: new Date('2026-10-01T10:00:00.000Z'),
      timezone: 'Asia/Shanghai',
      statuses: ['散步'],
      echoExcluded: false,
      summaryExcluded: false,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      media: { id: 'media-1' },
      topics: [{ topicId: 'topic-love', topic: { id: 'topic-love', name: '恋爱' } }],
      copyLinks: [{ copy: { id: 'copy-love', name: '恋爱长跑' } }],
    };
    const fakePrisma = {
      appLockSetting: { findUnique: vi.fn(async () => null) },
      memory: {
        count: vi.fn(async () => 1),
        findMany: vi.fn(async () => [row]),
      },
      $connect: vi.fn(),
      $disconnect: vi.fn(),
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const response = await request(app.getHttpServer())
      .post('/api/memories/search')
      .send({ keywords: ['海边'], pageSize: 5, matchMode: 'EXACT', sort: 'NEWEST' })
      .expect(201);

    expect(response.body).toMatchObject({ total: 1, items: [{ id: 'memory-1', longTermCopies: [{ name: '恋爱长跑' }] }] });
    await app.close();
  });
});
