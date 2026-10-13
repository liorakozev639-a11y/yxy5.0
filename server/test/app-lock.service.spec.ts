import { describe, expect, it, vi } from 'vitest';
import { hashOpaqueToken } from '../src/app-lock/app-lock.crypto.js';
import { AppLockService } from '../src/app-lock/app-lock.service.js';

function makePrisma() {
  let setting: any = null;
  const sessions: any[] = [];
  const prisma: any = {
    appLockSetting: {
      findUnique: vi.fn(async () => setting),
      create: vi.fn(async ({ data }: any) => {
        setting = { enabled: true, failedAttempts: 0, lockedUntil: null, ...data, createdAt: new Date(), updatedAt: new Date() };
        return setting;
      }),
      update: vi.fn(async ({ data }: any) => { setting = { ...setting, ...data, updatedAt: new Date() }; return setting; }),
    },
    appSession: {
      create: vi.fn(async ({ data }: any) => { const row = { id: `session-${sessions.length + 1}`, ...data, createdAt: new Date() }; sessions.push(row); return row; }),
      findUnique: vi.fn(async ({ where }: any) => sessions.find((item) => item.tokenHash === where.tokenHash) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const row = sessions.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: any = {}) => {
        const before = sessions.length;
        for (let index = sessions.length - 1; index >= 0; index -= 1) {
          const item = sessions[index];
          if (!where || (where.userId && item.userId === where.userId) || (where.id && item.id === where.id)) sessions.splice(index, 1);
        }
        return { count: before - sessions.length };
      }),
    },
  };
  return { prisma, sessions, getSetting: () => setting, setSetting: (value: any) => { setting = value; } };
}

describe('AppLockService', () => {
  it('returns a recovery key once and only persists its digest', async () => {
    const state = makePrisma();
    const service = new AppLockService(state.prisma);

    const result = await service.setup('local-user', 'Safe-password-2026', 30);

    expect(result.recoveryKey).toBeTruthy();
    expect(result.sessionToken).toBeTruthy();
    expect(JSON.stringify(state.getSetting())).not.toContain(result.recoveryKey);
    expect(JSON.stringify(state.getSetting())).not.toContain('Safe-password-2026');
    await expect(service.status('local-user')).resolves.not.toHaveProperty('recoveryKey');
  });

  it('rate-limits unlock after five failed passwords', async () => {
    const state = makePrisma();
    const service = new AppLockService(state.prisma);
    await service.setup('local-user', 'Safe-password-2026', 30);
    await service.lock('local-user');

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(service.unlock('local-user', 'wrong-password')).rejects.toThrow(/密码/);
    }
    await expect(service.unlock('local-user', 'wrong-password')).rejects.toThrow(/稍后/);

    expect(state.getSetting().failedAttempts).toBe(5);
    expect(state.getSetting().lockedUntil).toBeInstanceOf(Date);
  });

  it('rejects expired sessions and removes them', async () => {
    const state = makePrisma();
    state.setSetting({
      userId: 'local-user', enabled: true, passwordHash: 'unused', recoveryKeyHash: 'unused',
      autoLockMinutes: 30, failedAttempts: 0, lockedUntil: null,
    });
    state.sessions.push({
      id: 'expired', userId: 'local-user', tokenHash: hashOpaqueToken('raw-token'), verifiedUntil: null,
      lastActivityAt: new Date('2026-01-01'), expiresAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'),
    });
    const service = new AppLockService(state.prisma);

    await expect(service.authenticateSession('raw-token', new Date('2026-10-13'))).resolves.toBeNull();
    expect(state.prisma.appSession.deleteMany).toHaveBeenCalled();
  });

  it('can re-enable a paused lock and invalidates old sessions when the password changes', async () => {
    const state = makePrisma();
    const service = new AppLockService(state.prisma);
    const setup = await service.setup('local-user', 'Safe-password-2026', 30);
    await service.updateSettings('local-user', { enabled: false });

    const reenabled = await service.unlock('local-user', 'Safe-password-2026');
    expect(state.getSetting().enabled).toBe(true);
    const changed = await service.changePassword('local-user', reenabled.sessionToken, 'Safe-password-2026', 'New-password-2026');

    await expect(service.authenticateSession(setup.sessionToken)).resolves.toBeNull();
    await expect(service.authenticateSession(reenabled.sessionToken)).resolves.toBeNull();
    await expect(service.authenticateSession(changed.sessionToken)).resolves.toMatchObject({ userId: 'local-user' });
    await expect(service.unlock('local-user', 'Safe-password-2026')).rejects.toThrow(/密码/);
  });
});
