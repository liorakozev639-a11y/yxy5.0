import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { LOCAL_USER_ID } from '../common/local-user.js';
import { ListEchoesQueryDto, SaveEchoReflectionDto, UpdateEchoPreferenceDto } from './echo.dto.js';
import { EchoesService } from './echoes.service.js';

@Controller('echoes')
export class EchoesController {
  constructor(private readonly echoesService: EchoesService) {}

  @Get('today')
  today() { return this.echoesService.today(LOCAL_USER_ID); }

  @Get('reflections/:memoryId')
  reflections(@Param('memoryId') memoryId: string) { return this.echoesService.listReflections(LOCAL_USER_ID, memoryId); }

  @Get()
  list(@Query() query: ListEchoesQueryDto) { return this.echoesService.list(LOCAL_USER_ID, query.days); }

  @Put(':id/reflection')
  saveReflection(@Param('id') id: string, @Body() input: SaveEchoReflectionDto) {
    return this.echoesService.upsertReflection(LOCAL_USER_ID, id, input.text);
  }

  @Post(':id/dismiss')
  dismiss(@Param('id') id: string) { return this.echoesService.dismiss(LOCAL_USER_ID, id); }

  @Get('preferences/current')
  preferences() { return this.echoesService.getPreferences(LOCAL_USER_ID); }

  @Patch('preferences/current')
  updatePreferences(@Body() input: UpdateEchoPreferenceDto) { return this.echoesService.updatePreferences(LOCAL_USER_ID, input); }
}
