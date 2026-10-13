import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { isTrustedLocalOrigin, LOCAL_BIND_HOST } from './common/local-security.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => callback(null, isTrustedLocalOrigin(origin)),
  });
  await app.listen(Number(process.env.PORT ?? 3001), LOCAL_BIND_HOST);
}

void bootstrap();
