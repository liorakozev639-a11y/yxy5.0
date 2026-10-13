import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService, UPLOAD_DIR } from './media.service.js';

@Module({
  controllers: [MediaController],
  providers: [MediaService, { provide: UPLOAD_DIR, useValue: process.env.UPLOAD_DIR ?? 'D:\\yxy5.0\\data\\uploads' }],
  exports: [MediaService],
})
export class MediaModule {}
