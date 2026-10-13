import { Module } from '@nestjs/common';
import { SummariesController } from './summaries.controller.js';
import { SummariesService } from './summaries.service.js';

@Module({ controllers: [SummariesController], providers: [SummariesService], exports: [SummariesService] })
export class SummariesModule {}
