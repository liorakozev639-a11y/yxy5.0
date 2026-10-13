import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type TopicInput = { name: string; color?: string; icon?: string; isNone?: boolean; suppressLongTermPrompt?: boolean; echoEnabled?: boolean };

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.topic.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async create(userId: string, input: TopicInput) {
    const name = input.name.trim();
    const existing = await this.prisma.topic.findFirst({ where: { userId, name } });
    if (existing) throw new ConflictException('主题名称已经存在');
    return this.prisma.topic.create({ data: { userId, name, color: input.color, icon: input.icon, isNone: input.isNone ?? false } });
  }

  async update(userId: string, id: string, input: Partial<TopicInput>) {
    const topic = await this.prisma.topic.findFirst({ where: { id, userId } });
    if (!topic) throw new NotFoundException('主题不存在');
    return this.prisma.topic.update({ where: { id }, data: { ...input, name: input.name?.trim() } });
  }

  async remove(userId: string, id: string) {
    const topic = await this.prisma.topic.findFirst({ where: { id, userId } });
    if (!topic) throw new NotFoundException('主题不存在');
    await this.prisma.topic.delete({ where: { id } });
  }

  async setEchoEnabled(userId: string, id: string, echoEnabled: boolean) {
    const topic = await this.prisma.topic.findFirst({ where: { id, userId } });
    if (!topic) throw new NotFoundException('主题不存在');
    return this.prisma.topic.update({ where: { id }, data: { echoEnabled } });
  }
}
