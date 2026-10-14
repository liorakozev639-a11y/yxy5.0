import { Module } from '@nestjs/common';
import { SummariesController, SummaryPreferencesController } from './summaries.controller.js';
import { SummariesService } from './summaries.service.js';
import { SummarySnapshotService } from './summary-snapshot.service.js';
import { SummaryTemplateService } from './summary-template.service.js';
import { SummaryAiAdapter } from './summary-ai.adapter.js';
import { SummaryValidationService } from './summary-validation.service.js';

@Module({
  controllers: [SummariesController, SummaryPreferencesController],
  providers: [
    SummariesService,
    SummarySnapshotService,
    SummaryTemplateService,
    { provide: SummaryAiAdapter, useFactory: () => new SummaryAiAdapter() },
    SummaryValidationService,
  ],
  exports: [SummariesService, SummarySnapshotService, SummaryTemplateService, SummaryAiAdapter, SummaryValidationService],
})
export class SummariesModule {}
