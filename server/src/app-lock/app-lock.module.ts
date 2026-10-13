import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppLockController } from './app-lock.controller.js';
import { AppLockGuard } from './app-lock.guard.js';
import { AppLockService } from './app-lock.service.js';

@Module({
  controllers: [AppLockController],
  providers: [AppLockService, AppLockGuard, { provide: APP_GUARD, useExisting: AppLockGuard }],
  exports: [AppLockService],
})
export class AppLockModule {}
