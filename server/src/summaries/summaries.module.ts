import { Module } from '@nestjs/common';
import { SummariesController, SummaryPreferencesController } from './summaries.controller.js';
import { SummariesService } from './summaries.service.js';

@Module({ controllers: [SummariesController, SummaryPreferencesController], providers: [SummariesService], exports: [SummariesService] })
export class SummariesModule {}
