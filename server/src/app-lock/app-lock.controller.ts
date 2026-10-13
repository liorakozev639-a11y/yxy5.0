import { Body, Controller, Get, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LOCAL_USER_ID } from '../common/local-user.js';
import { AppLockControllerCookieName, readCookie } from './app-lock.guard.js';
import { ChangeAppLockPasswordDto, RecoverAppLockDto, SetupAppLockDto, UnlockAppLockDto, UpdateAppLockDto } from './app-lock.dto.js';
import { AppLockService } from './app-lock.service.js';

function setSessionCookie(response: Response, token: string, autoLockMinutes: number) {
  response.cookie(AppLockControllerCookieName, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: false,
    path: '/api',
    maxAge: autoLockMinutes * 60_000,
  });
}

function sessionToken(request: Request): string | undefined {
  return readCookie(request.headers.cookie, AppLockControllerCookieName);
}

@Controller('app-lock')
export class AppLockController {
  constructor(private readonly appLock: AppLockService) {}

  @Get('status')
  status(@Req() request: Request) {
    return this.appLock.status(LOCAL_USER_ID, sessionToken(request));
  }

  @Post('setup')
  async setup(@Body() input: SetupAppLockDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.appLock.setup(LOCAL_USER_ID, input.password, input.autoLockMinutes);
    setSessionCookie(response, result.sessionToken, result.autoLockMinutes);
    return { recoveryKey: result.recoveryKey, autoLockMinutes: result.autoLockMinutes };
  }

  @Post('unlock')
  async unlock(@Body() input: UnlockAppLockDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.appLock.unlock(LOCAL_USER_ID, input.password);
    setSessionCookie(response, result.sessionToken, result.autoLockMinutes);
    return { unlocked: true };
  }

  @Post('verify')
  verify(@Req() request: Request, @Body() input: UnlockAppLockDto) {
    return this.appLock.verify(LOCAL_USER_ID, sessionToken(request), input.password);
  }

  @Post('lock')
  async lock(@Res({ passthrough: true }) response: Response) {
    const result = await this.appLock.lock(LOCAL_USER_ID);
    response.clearCookie(AppLockControllerCookieName, { path: '/api' });
    return result;
  }

  @Patch('settings')
  async updateSettings(@Req() request: Request, @Body() input: UpdateAppLockDto) {
    await this.appLock.requireRecentVerification(sessionToken(request));
    return this.appLock.updateSettings(LOCAL_USER_ID, input);
  }

  @Post('change-password')
  async changePassword(@Req() request: Request, @Body() input: ChangeAppLockPasswordDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.appLock.changePassword(LOCAL_USER_ID, sessionToken(request), input.currentPassword, input.newPassword);
    setSessionCookie(response, result.sessionToken, result.autoLockMinutes);
    return { changed: true };
  }

  @Post('recover')
  async recover(@Body() input: RecoverAppLockDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.appLock.recover(LOCAL_USER_ID, input.recoveryKey, input.newPassword);
    setSessionCookie(response, result.sessionToken, result.autoLockMinutes);
    return { recoveryKey: result.recoveryKey, recovered: true };
  }
}
