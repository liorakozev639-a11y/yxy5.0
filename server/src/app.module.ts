import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { MediaModule } from './media/media.module.js';
import { TopicsModule } from './topics/topics.module.js';
import { MemoriesModule } from './memories/memories.module.js';
import { LongTermCopiesModule } from './long-term-copies/long-term-copies.module.js';
import { EchoesModule } from './echoes/echoes.module.js';
import { AppLockModule } from './app-lock/app-lock.module.js';
import { SummariesModule } from './summaries/summaries.module.js';
import { VaultModule } from './vault/vault.module.js';

@Module({
  controllers: [HealthController],
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AppLockModule, MediaModule, TopicsModule, MemoriesModule, LongTermCopiesModule, EchoesModule, SummariesModule, VaultModule],
})
export class AppModule {}
