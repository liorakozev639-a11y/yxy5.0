import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LOCAL_USER_ID } from '../common/local-user.js';
import { SummariesService } from './summaries.service.js';
import type { SummaryPeriod } from './summary.domain.js';
import {
  GenerateSummaryDto,
  ListSummariesQueryDto,
  SaveSummaryReflectionDto,
  UpdateSummaryPageDto,
  UpdateSummaryPreferenceDto,
  UpdateSummaryProgressDto,
} from './summary.dto.js';

@Controller('summaries')
export class SummariesController {
  constructor(private readonly summaries: SummariesService) {}

  @Get('check')
  check() { return this.summaries.checkDue(LOCAL_USER_ID, new Date()); }

  @Post('generate')
  generate(@Body() input: GenerateSummaryDto) { return this.summaries.generate(LOCAL_USER_ID, input); }

  @Get()
  list(@Query() query: ListSummariesQueryDto) {
    const { period, date, periodType } = query;
    if (period || date) {
      if (period !== 'month' && period !== 'year') throw new BadRequestException('period 必须是 month 或 year');
      if (!date) throw new BadRequestException('date 不能为空');
      return this.summaries.get(LOCAL_USER_ID, period as SummaryPeriod, date);
    }
    return this.summaries.list(LOCAL_USER_ID, { periodType });
  }

  @Get(':id')
  getById(@Param('id') id: string) { return this.summaries.getById(LOCAL_USER_ID, id); }

  @Patch(':id/progress')
  updateProgress(@Param('id') id: string, @Body() input: UpdateSummaryProgressDto) {
    return this.summaries.updateProgress(LOCAL_USER_ID, id, input);
  }

  @Patch(':id/pages/:pageId')
  updatePage(@Param('id') id: string, @Param('pageId') pageId: string, @Body() input: UpdateSummaryPageDto) {
    return this.summaries.updatePage(LOCAL_USER_ID, id, pageId, input);
  }

  @Post(':id/regenerate')
  regenerate(@Param('id') id: string) { return this.summaries.regenerate(LOCAL_USER_ID, id); }

  @Post(':id/reflection')
  saveReflection(@Param('id') id: string, @Body() input: SaveSummaryReflectionDto) {
    return this.summaries.saveReflection(LOCAL_USER_ID, id, input);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.summaries.remove(LOCAL_USER_ID, id); }
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
