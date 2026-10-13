import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { LOCAL_USER_ID } from '../common/local-user.js';
import { SummariesService } from './summaries.service.js';
import type { SummaryPeriod } from './summary.domain.js';

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
