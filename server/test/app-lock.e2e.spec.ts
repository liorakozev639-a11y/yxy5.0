import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppLockController } from '../src/app-lock/app-lock.controller.js';
import { AppLockGuard } from '../src/app-lock/app-lock.guard.js';
import { AppLockService } from '../src/app-lock/app-lock.service.js';

class PrivateCheckController {
  check() { return { ok: true }; }
}

Controller('private-check')(PrivateCheckController);
Get()(PrivateCheckController.prototype, 'check', Object.getOwnPropertyDescriptor(PrivateCheckController.prototype, 'check')!);

describe('app-lock HTTP gate', () => {
  let app: INestApplication | undefined;

  afterEach(async () => app?.close());

  it('blocks business APIs while locked and emits a secure same-site cookie after unlock', async () => {
    const service = {
      status: vi.fn(async () => ({ configured: true, enabled: true, locked: true, autoLockMinutes: 30 })),
      unlock: vi.fn(async () => ({ sessionToken: 'raw-session-token', autoLockMinutes: 30 })),
      setup: vi.fn(), verify: vi.fn(), lock: vi.fn(), updateSettings: vi.fn(), recover: vi.fn(),
      isLockEnabled: vi.fn(async () => true),
      authenticateSession: vi.fn(async (token: string | undefined) => token === 'raw-session-token' ? { id: 'session-1', userId: 'local-user' } : null),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AppLockController, PrivateCheckController],
      providers: [
        { provide: AppLockService, useValue: service },
        { provide: APP_GUARD, useClass: AppLockGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    await request(app.getHttpServer()).get('/api/private-check').expect(401);
    const unlock = await request(app.getHttpServer())
      .post('/api/app-lock/unlock')
      .send({ password: 'Safe-password-2026' })
      .expect(201);
    expect(unlock.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(unlock.headers['set-cookie']?.[0]).toContain('SameSite=Strict');

    await request(app.getHttpServer())
      .get('/api/private-check')
      .set('Cookie', 'photo_memory_session=raw-session-token')
      .expect(200, { ok: true });
  });
});
