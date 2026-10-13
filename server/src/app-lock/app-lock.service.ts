import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { createOpaqueSecret, hashOpaqueToken, hashSecret, verifySecret } from './app-lock.crypto.js';

const MAX_FAILED_ATTEMPTS = 5;
const FAILURE_LOCK_MINUTES = 15;
const RECENT_VERIFICATION_MINUTES = 5;

function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60_000);
}

export interface AuthenticatedAppSession {
  id: string;
  userId: string;
  verifiedUntil: Date | null;
}

@Injectable()
export class AppLockService {
  constructor(private readonly prisma: PrismaService) {}

  async status(userId: string, sessionToken?: string, now = new Date()) {
    const setting = await this.prisma.appLockSetting.findUnique({ where: { userId } });
    if (!setting) return { configured: false, enabled: false, locked: false, autoLockMinutes: 30 };

    const session = setting.enabled ? await this.authenticateSession(sessionToken, now) : null;
    return {
      configured: true,
      enabled: setting.enabled,
      locked: setting.enabled && !session,
      autoLockMinutes: setting.autoLockMinutes,
      temporarilyLockedUntil: setting.lockedUntil,
    };
  }

  async isLockEnabled(userId: string): Promise<boolean> {
    const setting = await this.prisma.appLockSetting.findUnique({ where: { userId }, select: { enabled: true } });
    return setting?.enabled === true;
  }

  async setup(userId: string, password: string, autoLockMinutes = 30, now = new Date()) {
    const existing = await this.prisma.appLockSetting.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('应用锁已经设置');

    const recoveryKey = createOpaqueSecret();
    const [passwordHash, recoveryKeyHash] = await Promise.all([hashSecret(password), hashSecret(recoveryKey)]);
    await this.prisma.appLockSetting.create({
      data: { userId, passwordHash, recoveryKeyHash, autoLockMinutes },
    });
    const session = await this.createSession(userId, autoLockMinutes, now);
    return { recoveryKey, ...session };
  }

  async unlock(userId: string, password: string, now = new Date()) {
    const setting = await this.prisma.appLockSetting.findUnique({ where: { userId } });
    if (!setting) throw new UnauthorizedException('应用锁未设置');
    if (setting.lockedUntil && setting.lockedUntil > now) {
      throw new HttpException('尝试次数过多，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!(await verifySecret(password, setting.passwordHash))) {
      const failedAttempts = setting.failedAttempts + 1;
      const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? addMinutes(now, FAILURE_LOCK_MINUTES) : null;
      await this.prisma.appLockSetting.update({ where: { userId }, data: { failedAttempts, lockedUntil } });
      if (lockedUntil) throw new HttpException('尝试次数过多，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
      throw new UnauthorizedException('密码不正确');
    }

    await this.prisma.appLockSetting.update({ where: { userId }, data: { enabled: true, failedAttempts: 0, lockedUntil: null } });
    return this.createSession(userId, setting.autoLockMinutes, now);
  }

  async changePassword(userId: string, rawToken: string | undefined, currentPassword: string, newPassword: string, now = new Date()) {
    const session = await this.authenticateSession(rawToken, now);
    if (!session || session.userId !== userId) throw new UnauthorizedException('请先解锁应用');
    const setting = await this.prisma.appLockSetting.findUnique({ where: { userId } });
    if (!setting || !(await verifySecret(currentPassword, setting.passwordHash))) throw new UnauthorizedException('当前密码不正确');
    const passwordHash = await hashSecret(newPassword);
    await this.prisma.appSession.deleteMany({ where: { userId } });
    await this.prisma.appLockSetting.update({ where: { userId }, data: { passwordHash, failedAttempts: 0, lockedUntil: null } });
    return this.createSession(userId, setting.autoLockMinutes, now);
  }

  async authenticateSession(rawToken: string | undefined, now = new Date()): Promise<AuthenticatedAppSession | null> {
    if (!rawToken) return null;
    const session = await this.prisma.appSession.findUnique({ where: { tokenHash: hashOpaqueToken(rawToken) } });
    if (!session) return null;
    if (session.expiresAt <= now) {
      await this.prisma.appSession.deleteMany({ where: { id: session.id } });
      return null;
    }

    const setting = await this.prisma.appLockSetting.findUnique({ where: { userId: session.userId } });
    if (!setting?.enabled) return null;
    const expiresAt = addMinutes(now, setting.autoLockMinutes);
    await this.prisma.appSession.update({ where: { id: session.id }, data: { lastActivityAt: now, expiresAt } });
    return { id: session.id, userId: session.userId, verifiedUntil: session.verifiedUntil };
  }

  async verify(userId: string, rawToken: string | undefined, password: string, now = new Date()) {
    const session = await this.authenticateSession(rawToken, now);
    if (!session || session.userId !== userId) throw new UnauthorizedException('请先解锁应用');
    const setting = await this.prisma.appLockSetting.findUnique({ where: { userId } });
    if (!setting || !(await verifySecret(password, setting.passwordHash))) throw new UnauthorizedException('密码不正确');
    const verifiedUntil = addMinutes(now, RECENT_VERIFICATION_MINUTES);
    await this.prisma.appSession.update({ where: { id: session.id }, data: { verifiedUntil } });
    return { verifiedUntil };
  }

  async requireRecentVerification(rawToken: string | undefined, now = new Date()) {
    const session = await this.authenticateSession(rawToken, now);
    if (!session?.verifiedUntil || session.verifiedUntil <= now) {
      throw new UnauthorizedException('此操作需要再次验证应用锁密码');
    }
    return session;
  }

  async lock(userId: string) {
    await this.prisma.appSession.deleteMany({ where: { userId } });
    return { locked: true };
  }

  async updateSettings(userId: string, input: { enabled?: boolean; autoLockMinutes?: number }) {
    const setting = await this.prisma.appLockSetting.findUnique({ where: { userId } });
    if (!setting) throw new UnauthorizedException('请先设置应用锁');
    const updated = await this.prisma.appLockSetting.update({ where: { userId }, data: input });
    if (input.enabled === false) await this.prisma.appSession.deleteMany({ where: { userId } });
    return { configured: true, enabled: updated.enabled, autoLockMinutes: updated.autoLockMinutes };
  }

  async recover(userId: string, recoveryKey: string, newPassword: string, now = new Date()) {
    const setting = await this.prisma.appLockSetting.findUnique({ where: { userId } });
    if (!setting || !(await verifySecret(recoveryKey, setting.recoveryKeyHash))) {
      throw new UnauthorizedException('恢复密钥无效');
    }
    const nextRecoveryKey = createOpaqueSecret();
    const [passwordHash, recoveryKeyHash] = await Promise.all([hashSecret(newPassword), hashSecret(nextRecoveryKey)]);
    await this.prisma.appSession.deleteMany({ where: { userId } });
    await this.prisma.appLockSetting.update({
      where: { userId },
      data: { passwordHash, recoveryKeyHash, failedAttempts: 0, lockedUntil: null, enabled: true },
    });
    const session = await this.createSession(userId, setting.autoLockMinutes, now);
    return { recoveryKey: nextRecoveryKey, ...session };
  }

  private async createSession(userId: string, autoLockMinutes: number, now: Date) {
    const sessionToken = createOpaqueSecret();
    await this.prisma.appSession.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(sessionToken),
        lastActivityAt: now,
        expiresAt: addMinutes(now, autoLockMinutes),
        verifiedUntil: addMinutes(now, RECENT_VERIFICATION_MINUTES),
      },
    });
    return { sessionToken, autoLockMinutes };
  }
}
