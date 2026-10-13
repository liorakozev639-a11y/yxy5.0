import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { LOCAL_USER_ID } from '../common/local-user.js';
import { AppLockService } from './app-lock.service.js';

const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/app-lock/status',
  '/api/app-lock/setup',
  '/api/app-lock/unlock',
  '/api/app-lock/recover',
]);

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

@Injectable()
export class AppLockGuard implements CanActivate {
  constructor(private readonly appLock: AppLockService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { appSession?: unknown }>();
    const path = request.originalUrl?.split('?')[0] ?? request.url?.split('?')[0] ?? '';
    if (PUBLIC_PATHS.has(path)) return true;
    if (!(await this.appLock.isLockEnabled(LOCAL_USER_ID))) return true;

    const token = readCookie(request.headers.cookie, AppLockControllerCookieName);
    const session = await this.appLock.authenticateSession(token);
    if (!session || session.userId !== LOCAL_USER_ID) throw new UnauthorizedException('应用已锁定');
    request.appSession = session;
    return true;
  }
}

export const AppLockControllerCookieName = 'photo_memory_session';
