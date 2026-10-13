import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LOCAL_USER_ID } from '../common/local-user.js';
import { MemoriesService } from './memories.service.js';
import { CreateMemoryDto, MemoryFilterDto, UpdateMemoryDto, UpdateMemoryEchoSettingDto } from './memory.dto.js';

@Controller('memories')
export class MemoriesController {
  constructor(private readonly memoriesService: MemoriesService) {}

  @Post()
  create(@Body() input: CreateMemoryDto) { return this.memoriesService.create(LOCAL_USER_ID, input); }

  @Get()
  list(@Query() filter: MemoryFilterDto) { return this.memoriesService.list(LOCAL_USER_ID, filter); }

  @Get(':id')
  get(@Param('id') id: string) { return this.memoriesService.get(LOCAL_USER_ID, id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateMemoryDto) { return this.memoriesService.update(LOCAL_USER_ID, id, input); }

  @Patch(':id/echo-setting')
  setEchoSetting(@Param('id') id: string, @Body() input: UpdateMemoryEchoSettingDto) {
    return this.memoriesService.setEchoExcluded(LOCAL_USER_ID, id, input.echoExcluded);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.memoriesService.remove(LOCAL_USER_ID, id); }
}
