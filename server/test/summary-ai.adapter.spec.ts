import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { SummaryAiAdapter } from '../src/summaries/summary-ai.adapter.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { SummaryAiInput, SummarySnapshot } from '../src/summaries/summary-story.types.js';

function input(overrides: Partial<SummarySnapshot> = {}): SummaryAiInput {
  const snapshot: SummarySnapshot = {
    periodType: 'MONTH', periodKey: '2026-02', label: '2026年2月',
    range: { start: '2026-01-31T16:00:00.000Z', end: '2026-02-28T16:00:00.000Z' },
    memories: [{
      id: 'memory-1', mediaId: 'media-1', imageUrl: '/api/media/media-1/file', storagePath: 'D:\\private\\one.jpg',
      title: '海边散步', note: '风很温柔', mood: '开心', eventAt: '2026-02-02T04:00:00.000Z', statuses: ['散步'], topics: ['恋爱'],
      summaryExcluded: false, deletedAt: null,
    }],
    memoryCount: 1, photoCount: 1, recordedDays: 1,
    topTopics: [{ name: '恋爱', count: 1 }], topMoods: [{ name: '开心', count: 1 }], topStatuses: [{ name: '散步', count: 1 }],
    longTermCopies: [], allowText: true, allowPhotos: true, sourceHash: 'hash',
    ...overrides,
  };
  return {
    snapshot,
    pages: [{ pageType: 'MOOD', displayOrder: 0, templateKey: 'lead-mood', narration: '', factRefs: ['mood:开心'], payload: {} }],
  };
}

const config = { baseUrl: 'https://ai.example.test', apiKey: 'secret-key', model: 'summary-model', timeoutMs: 1000 };

describe('SummaryAiAdapter', () => {
  it('lets Nest construct the production adapter without interface injection tokens', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(moduleRef.get(SummaryAiAdapter)).toBeInstanceOf(SummaryAiAdapter);
    await moduleRef.close();
  });

  it('sends only consented structured facts and keeps secrets in the authorization header', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ pages: [{ pageType: 'MOOD', displayOrder: 0, narration: '这个月，你记录最多的是开心。', factRefs: ['mood:开心'] }] }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const adapter = new SummaryAiAdapter(config, fetcher as typeof fetch);
    const result = await adapter.generate(input({ allowText: false, allowPhotos: false }));

    expect(result.ok).toBe(true);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://ai.example.test/v1/chat/completions');
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    const body = JSON.parse(String(options.body));
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('secret-key');
    expect(serialized).not.toContain('海边散步');
    expect(serialized).not.toContain('风很温柔');
    expect(serialized).not.toContain('media-1');
    expect(serialized).not.toContain('D:\\private');
  });

  it('returns a safe unavailable result when cloud configuration is missing', async () => {
    const adapter = new SummaryAiAdapter({ baseUrl: '', apiKey: '', model: '', timeoutMs: 1000 }, vi.fn() as any);
    await expect(adapter.generate(input())).resolves.toEqual({ ok: false, reason: 'UNAVAILABLE' });
  });

  it('returns a safe timeout result when the request exceeds the configured limit', async () => {
    const fetcher = vi.fn((_url: string | URL | Request, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const adapter = new SummaryAiAdapter({ ...config, timeoutMs: 5 }, fetcher as typeof fetch);

    await expect(adapter.generate(input())).resolves.toEqual({ ok: false, reason: 'TIMEOUT' });
  });

  it('does not expose remote response bodies for HTTP or malformed JSON failures', async () => {
    const serverError = new SummaryAiAdapter(config, vi.fn(async () => new Response('provider-secret-error', { status: 500 })) as any);
    const malformed = new SummaryAiAdapter(config, vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'not-json' } }] }), { status: 200 })) as any);

    await expect(serverError.generate(input())).resolves.toEqual({ ok: false, reason: 'REMOTE_ERROR' });
    await expect(malformed.generate(input())).resolves.toEqual({ ok: false, reason: 'INVALID_RESPONSE' });
  });
});
