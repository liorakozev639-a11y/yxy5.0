import { Module } from '@nestjs/common';
import { EchoesController } from './echoes.controller.js';
import { EchoesService } from './echoes.service.js';

@Module({ controllers: [EchoesController], providers: [EchoesService], exports: [EchoesService] })
export class EchoesModule {}
