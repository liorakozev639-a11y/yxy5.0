import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const topics = [
    { name: '无', isNone: true },
    { name: '恋爱', isNone: false },
    { name: '考研', isNone: false },
    { name: '读研', isNone: false },
  ];
  for (const topic of topics) {
    await prisma.topic.upsert({
      where: { userId_name: { userId: process.env.LOCAL_USER_ID ?? 'local-user', name: topic.name } },
      update: { isNone: topic.isNone },
      create: { userId: process.env.LOCAL_USER_ID ?? 'local-user', ...topic },
    });
  }
}

main().finally(() => prisma.$disconnect());
