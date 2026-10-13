import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LOCAL_USER_ID } from '../common/local-user.js';
import { LongTermCopiesService } from './long-term-copies.service.js';
import { CreateLongTermCopyDto, TimelineQueryDto, UpdateLongTermCopyDto } from './long-term-copy.dto.js';

@Controller('long-term-copies')
export class LongTermCopiesController {
  constructor(private readonly copiesService: LongTermCopiesService) {}

  @Get()
  list() { return this.copiesService.list(LOCAL_USER_ID); }

  @Post()
  create(@Body() body: CreateLongTermCopyDto) { return this.copiesService.create(LOCAL_USER_ID, body, body.backfill ?? false); }

  @Get(':id')
  get(@Param('id') id: string) { return this.copiesService.get(LOCAL_USER_ID, id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateLongTermCopyDto) { return this.copiesService.update(LOCAL_USER_ID, id, body); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.copiesService.remove(LOCAL_USER_ID, id); }

  @Post(':id/backfill')
  backfill(@Param('id') id: string) { return this.copiesService.backfill(LOCAL_USER_ID, id); }

  @Get(':id/timeline')
  timeline(@Param('id') id: string, @Query() page: TimelineQueryDto) { return this.copiesService.timeline(LOCAL_USER_ID, id, page); }
}
