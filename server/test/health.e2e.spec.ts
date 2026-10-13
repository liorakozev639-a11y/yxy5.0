import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('health endpoint', () => {
  it('returns ok', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    await request(app.getHttpServer()).get('/api/health').expect(200).expect({ status: 'ok' });
    await app.close();
  });
});
