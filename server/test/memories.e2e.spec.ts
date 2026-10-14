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
});
