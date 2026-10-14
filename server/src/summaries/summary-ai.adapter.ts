import { getSummaryAiConfig, type SummaryAiConfig } from '../common/config.js';
import type { SummaryAiInput, SummaryAiPage, SummaryAiResult } from './summary-story.types.js';

export class SummaryAiAdapter {
  constructor(
    private readonly config: SummaryAiConfig = getSummaryAiConfig(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async generate(input: SummaryAiInput): Promise<SummaryAiResult> {
    if (!this.config.baseUrl || !this.config.apiKey || !this.config.model) return { ok: false, reason: 'UNAVAILABLE' };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(`${this.config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: '你为个人照片记忆本写第二人称中文旁白。只能使用输入中的事实；不得新增经历、日期、数量、主题或情绪。返回 JSON：{"pages":[{"pageType":"...","displayOrder":0,"narration":"...","factRefs":["..."]}]}。',
            },
            { role: 'user', content: JSON.stringify(cloudInput(input)) },
          ],
        }),
      });
      if (!response.ok) return { ok: false, reason: 'REMOTE_ERROR' };
      const envelope = await response.json() as any;
      const content = envelope?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') return { ok: false, reason: 'INVALID_RESPONSE' };
      const parsed = JSON.parse(content) as { pages?: unknown };
      if (!Array.isArray(parsed.pages) || !parsed.pages.every(isAiPage)) return { ok: false, reason: 'INVALID_RESPONSE' };
      return { ok: true, pages: parsed.pages };
    } catch (error) {
      return { ok: false, reason: (error as { name?: string })?.name === 'AbortError' ? 'TIMEOUT' : 'INVALID_RESPONSE' };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function cloudInput(input: SummaryAiInput) {
  const { snapshot } = input;
  return {
    periodType: snapshot.periodType,
    periodKey: snapshot.periodKey,
    label: snapshot.label,
    memoryCount: snapshot.memoryCount,
    photoCount: snapshot.photoCount,
    recordedDays: snapshot.recordedDays,
    topTopics: snapshot.topTopics,
    topMoods: snapshot.topMoods,
    topStatuses: snapshot.topStatuses,
    longTermCopies: snapshot.longTermCopies.map(({ id, name, memoryCount }) => ({ id, name, memoryCount })),
    memories: snapshot.memories.map((memory) => ({
      id: memory.id,
      eventAt: memory.eventAt,
      mood: memory.mood,
      statuses: memory.statuses,
      topics: memory.topics,
      ...(snapshot.allowText ? { title: memory.title, note: memory.note } : {}),
      ...(snapshot.allowPhotos && memory.mediaId ? { mediaId: memory.mediaId } : {}),
    })),
    pages: input.pages.map(({ pageType, displayOrder, templateKey, factRefs }) => ({ pageType, displayOrder, templateKey, factRefs })),
  };
}

function isAiPage(value: unknown): value is SummaryAiPage {
  if (!value || typeof value !== 'object') return false;
  const page = value as Record<string, unknown>;
  return typeof page.pageType === 'string'
    && Number.isInteger(page.displayOrder)
    && typeof page.narration === 'string'
    && Array.isArray(page.factRefs)
    && page.factRefs.every((item) => typeof item === 'string');
}
