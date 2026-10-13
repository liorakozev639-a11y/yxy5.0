import { BadRequestException, Controller, Delete, Get, Param, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { ALLOWED_TYPES, MAX_FILE_SIZE, MediaService, type UploadFile } from './media.service.js';
import { LOCAL_USER_ID } from '../common/local-user.js';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_request, file, callback) => callback(ALLOWED_TYPES.has(file.mimetype) ? null : new BadRequestException('只支持图片文件'), ALLOWED_TYPES.has(file.mimetype)),
  }))
  create(@UploadedFile() file?: UploadFile) {
    return this.mediaService.createFromUpload(file, LOCAL_USER_ID);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mediaService.removeUnused(LOCAL_USER_ID, id);
  }

  @Get(':id/file')
  async file(@Param('id') id: string, @Res() response: Response, @Req() _request: Request) {
    const asset = await this.mediaService.getOwned(LOCAL_USER_ID, id);
    const path = await this.mediaService.getReadablePath(asset);
    response.type(asset.mimeType);
    return response.sendFile(path);
  }
}
