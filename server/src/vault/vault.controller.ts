import { BadRequestException, Controller, Get, Param, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { basename } from 'node:path';
import { AppLockControllerCookieName, readCookie } from '../app-lock/app-lock.guard.js';
import { AppLockService } from '../app-lock/app-lock.service.js';
import { LOCAL_USER_ID } from '../common/local-user.js';
import { resolveVaultChild } from '../common/config.js';
import { VaultExportService } from './vault-export.service.js';
import { type ImportUpload, VaultImportService } from './vault-import.service.js';
import { VaultBackupService } from './vault-backup.service.js';

@Controller('vault')
export class VaultController {
  constructor(private readonly exports: VaultExportService, private readonly imports: VaultImportService, private readonly backups: VaultBackupService, private readonly appLock: AppLockService) {}

  @Post('exports/json')
  async json(@Req() request: Request) { await this.verifySensitive(request); return publicExport(await this.exports.exportJson(LOCAL_USER_ID)); }

  @Post('exports/zip')
  async zip(@Req() request: Request) { await this.verifySensitive(request); return publicExport(await this.exports.exportZip(LOCAL_USER_ID)); }

  @Post('exports/pdf')
  async pdf(@Req() request: Request) { await this.verifySensitive(request); return publicExport(await this.exports.exportPdf(LOCAL_USER_ID)); }

  @Post('imports/inspect')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 250 * 1024 * 1024 } }))
  inspect(@UploadedFile() file?: ImportUpload) {
    return this.imports.inspect(LOCAL_USER_ID, file);
  }

  @Post('imports/:id/restore')
  async restore(@Param('id') id: string, @Req() request: Request) {
    await this.verifySensitive(request);
    return this.imports.restore(LOCAL_USER_ID, id);
  }

  @Get('status')
  status() { return this.backups.status(LOCAL_USER_ID); }

  @Get('storage')
  storage() { return this.backups.storage(); }

  @Get('backups')
  backupsList() { return this.backups.list(LOCAL_USER_ID); }

  @Post('backups')
  async backup(@Req() request: Request) {
    await this.verifySensitive(request);
    return this.backups.create(LOCAL_USER_ID);
  }

  @Get('files/:kind/:fileName')
  file(@Param('kind') kind: string, @Param('fileName') fileName: string, @Res() response: Response) {
    if (!['exports', 'backups'].includes(kind) || basename(fileName) !== fileName || !/^[A-Za-z0-9_.-]+$/.test(fileName)) throw new BadRequestException('文件路径无效');
    return response.sendFile(resolveVaultChild(kind as 'exports' | 'backups', fileName));
  }

  private async verifySensitive(request: Request) {
    if (!(await this.appLock.isLockEnabled(LOCAL_USER_ID))) return;
    await this.appLock.requireRecentVerification(readCookie(request.headers.cookie, AppLockControllerCookieName));
  }
}

function publicExport(result: Awaited<ReturnType<VaultExportService['exportJson']>>) {
  const { absolutePath: _absolutePath, ...metadata } = result;
  return metadata;
}
