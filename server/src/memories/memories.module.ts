import { Module } from '@nestjs/common';
import { MemoriesController } from './memories.controller.js';
import { MemoriesService } from './memories.service.js';
import { MemorySearchService } from './memory-search.service.js';

@Module({ controllers: [MemoriesController], providers: [MemoriesService, MemorySearchService], exports: [MemoriesService, MemorySearchService] })
export class MemoriesModule {}
