import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateLongTermCopyDto, UpdateLongTermCopyDto } from '../src/long-term-copies/long-term-copy.dto.js';
import { ListEchoesQueryDto, SaveEchoReflectionDto } from '../src/echoes/echo.dto.js';

describe('request DTO validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

  it('rejects a string pretending to be a false backfill boolean', async () => {
    await expect(pipe.transform({ name: '考研', topicId: 'topic-a', startDate: '2026-10-01T00:00:00.000Z', backfill: 'false' }, { type: 'body', metatype: CreateLongTermCopyDto })).rejects.toThrow();
  });

  it('rejects changing a long-term copy topic after creation', async () => {
    await expect(pipe.transform({ topicId: 'topic-b' }, { type: 'body', metatype: UpdateLongTermCopyDto })).rejects.toThrow();
  });

  it('rejects echo history windows longer than thirty days', async () => {
    await expect(pipe.transform({ days: 31 }, { type: 'query', metatype: ListEchoesQueryDto })).rejects.toThrow();
  });

  it('rejects echo reflections longer than two thousand characters', async () => {
    await expect(pipe.transform({ text: '回'.repeat(2001) }, { type: 'body', metatype: SaveEchoReflectionDto })).rejects.toThrow();
  });
});
