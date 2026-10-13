import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

async function createApp() {
  const fakePrisma = {
    appLockSetting: { findUnique: vi.fn(async () => null) },
    echoPreference: { findUnique: vi.fn(async () => ({ userId: 'local-user', enabled: false, excludedMoods: [] })) },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(fakePrisma)
    .compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
}

describe('memory echoes API', () => {
  it('returns no daily echoes when the feature is disabled', async () => {
    const app = await createApp();
    const response = await request(app.getHttpServer()).get('/api/echoes/today').expect(200);
    expect(response.body).toEqual([]);
    await app.close();
  });

  it('rejects history windows longer than thirty days', async () => {
    const app = await createApp();
    await request(app.getHttpServer()).get('/api/echoes?days=31').expect(400);
    await app.close();
  });

  it('rejects reflections longer than two thousand characters', async () => {
    const app = await createApp();
    await request(app.getHttpServer()).put('/api/echoes/echo-1/reflection').send({ text: '回'.repeat(2001) }).expect(400);
    await app.close();
  });
});
