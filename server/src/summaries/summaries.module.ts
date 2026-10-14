import { Module } from '@nestjs/common';
import { SummariesController, SummaryPreferencesController } from './summaries.controller.js';
import { SummariesService } from './summaries.service.js';
import { SummarySnapshotService } from './summary-snapshot.service.js';
import { SummaryTemplateService } from './summary-template.service.js';

@Module({
  controllers: [SummariesController, SummaryPreferencesController],
  providers: [SummariesService, SummarySnapshotService, SummaryTemplateService],
  exports: [SummariesService, SummarySnapshotService, SummaryTemplateService],
})
export class SummariesModule {}
