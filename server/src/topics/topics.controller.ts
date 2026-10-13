import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { LOCAL_USER_ID } from '../common/local-user.js';
import { TopicsService } from './topics.service.js';
import { CreateTopicDto, UpdateTopicDto, UpdateTopicEchoSettingDto } from './topic.dto.js';

@Controller('topics')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get()
  list() { return this.topicsService.list(LOCAL_USER_ID); }

  @Post()
  create(@Body() input: CreateTopicDto) { return this.topicsService.create(LOCAL_USER_ID, input); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateTopicDto) { return this.topicsService.update(LOCAL_USER_ID, id, input); }

  @Patch(':id/echo-setting')
  setEchoSetting(@Param('id') id: string, @Body() input: UpdateTopicEchoSettingDto) {
    return this.topicsService.setEchoEnabled(LOCAL_USER_ID, id, input.echoEnabled);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) { await this.topicsService.remove(LOCAL_USER_ID, id); return { ok: true }; }
}
