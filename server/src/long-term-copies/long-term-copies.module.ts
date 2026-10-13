import { Module } from '@nestjs/common';
import { LongTermCopiesController } from './long-term-copies.controller.js';
import { LongTermCopiesService } from './long-term-copies.service.js';

@Module({ controllers: [LongTermCopiesController], providers: [LongTermCopiesService], exports: [LongTermCopiesService] })
export class LongTermCopiesModule {}
