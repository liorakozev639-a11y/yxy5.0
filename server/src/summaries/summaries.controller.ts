import { BadRequestException, Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { LOCAL_USER_ID } from '../common/local-user.js';
import { SummariesService } from './summaries.service.js';
import type { SummaryPeriod } from './summary.domain.js';
import { UpdateSummaryPreferenceDto } from './summary.dto.js';

@Controller('summaries')
export class SummariesController {
  constructor(private readonly summaries: SummariesService) {}

  @Get()
  get(@Query('period') period: string, @Query('date') date: string) {
    if (period !== 'month' && period !== 'year') throw new BadRequestException('period 必须是 month 或 year');
    if (!date) throw new BadRequestException('date 不能为空');
    return this.summaries.get(LOCAL_USER_ID, period as SummaryPeriod, date);
  }
}

@Controller('summary-preferences')
export class SummaryPreferencesController {
  constructor(private readonly summaries: SummariesService) {}

  @Get()
  get() { return this.summaries.getPreferences(LOCAL_USER_ID); }

  @Patch()
  update(@Body() input: UpdateSummaryPreferenceDto) {
    return this.summaries.updatePreferences(LOCAL_USER_ID, input);
  }
}
