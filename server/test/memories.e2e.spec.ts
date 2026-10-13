import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('memories API', () => {
  it('returns an empty memory page for the local user', async () => {
    const fakePrisma = {
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
});
