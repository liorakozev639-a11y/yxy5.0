import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

async function createApp() {
  let preference: any = null;
  const fakePrisma = {
    appLockSetting: { findUnique: vi.fn(async () => null) },
    summaryPreference: {
      findUnique: vi.fn(async () => preference),
      upsert: vi.fn(async ({ create, update }: any) => {
        preference = preference ? { ...preference, ...update, updatedAt: new Date() } : { ...create, createdAt: new Date(), updatedAt: new Date() };
        return preference;
      }),
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
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
}

describe('summary privacy preference API', () => {
  it('persists reviewed preferences without exposing provider secrets', async () => {
    const app = await createApp();
    const initial = await request(app.getHttpServer()).get('/api/summary-preferences').expect(200);
    expect(initial.body).toMatchObject({ allowText: true, allowPhotos: true, allowCloudAi: false, reviewed: false });

    const updated = await request(app.getHttpServer()).patch('/api/summary-preferences').send({
      reviewed: true,
      allowText: true,
      allowPhotos: false,
      allowCloudAi: true,
    }).expect(200);
    expect(updated.body).toMatchObject({ allowText: true, allowPhotos: false, allowCloudAi: true, reviewed: true });
    expect(updated.body).not.toHaveProperty('apiKey');
    expect(updated.body).not.toHaveProperty('model');

    const reread = await request(app.getHttpServer()).get('/api/summary-preferences').expect(200);
    expect(reread.body).toMatchObject({ allowPhotos: false, allowCloudAi: true, reviewed: true });
    await app.close();
  });

  it('rejects enabling cloud AI without explicit review and rejects non-booleans', async () => {
    const app = await createApp();
    await request(app.getHttpServer()).patch('/api/summary-preferences').send({ allowCloudAi: true }).expect(400);
    await request(app.getHttpServer()).patch('/api/summary-preferences').send({ reviewed: true, allowText: 'yes' }).expect(400);
    await app.close();
  });
});
