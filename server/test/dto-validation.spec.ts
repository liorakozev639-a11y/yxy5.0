import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateLongTermCopyDto, UpdateLongTermCopyDto } from '../src/long-term-copies/long-term-copy.dto.js';
import { ListEchoesQueryDto, SaveEchoReflectionDto } from '../src/echoes/echo.dto.js';
import { MemorySearchDto } from '../src/memories/memory.dto.js';

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

  it.each([
    [{ keywords: ['回'.repeat(101)] }, 'keywords longer than one hundred characters in total'],
    [{ keywords: ['一', '二', '三', '四', '五', '六'] }, 'more than five keywords'],
    [{ statusValues: Array.from({ length: 11 }, (_, index) => `状态${index}`) }, 'more than ten statuses'],
    [{ topicIds: Array.from({ length: 11 }, (_, index) => `topic-${index}`) }, 'more than ten topics'],
    [{ sort: 'RANDOM' }, 'an invalid sort'],
    [{ matchMode: 'SEMANTIC' }, 'an invalid match mode'],
    [{ pageSize: 10 }, 'a page size other than five'],
  ])('rejects memory search input containing %s (%s)', async (input) => {
    await expect(pipe.transform(input, { type: 'body', metatype: MemorySearchDto })).rejects.toThrow();
  });

  it('accepts valid memory search input and strips unknown properties', async () => {
    const strippingPipe = new ValidationPipe({ whitelist: true, transform: true });
    const result = await strippingPipe.transform(
      {
        keywords: ['海边', '日落'],
        statusValues: ['散步'],
        topicIds: ['topic-love'],
        sort: 'NEWEST',
        matchMode: 'EXACT',
        pageSize: 5,
        unknown: 'discard me',
      },
      { type: 'body', metatype: MemorySearchDto },
    );

    expect(result).toMatchObject({
      keywords: ['海边', '日落'],
      statusValues: ['散步'],
      topicIds: ['topic-love'],
      sort: 'NEWEST',
      matchMode: 'EXACT',
      pageSize: 5,
    });
    expect(result).not.toHaveProperty('unknown');
  });
});
