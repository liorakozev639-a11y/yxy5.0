import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MemorySearchItem } from '../domain/memory-search';
import { MemorySearchTimeline } from './MemorySearchTimeline';

function memory(id: string, eventAt: string, overrides: Partial<MemorySearchItem> = {}): MemorySearchItem {
  return {
    id,
    imageBlob: new Blob(),
    imageName: `${id}.jpg`,
    imageUrl: `/api/media/${id}/file`,
    eventAt,
    title: `记忆 ${id}`,
    note: '一起沿着海边散步',
    mood: '开心',
    statuses: ['散步'],
    topics: [{ id: 'topic-love', name: '恋爱' }],
    topicIds: ['topic-love'],
    createdAt: eventAt,
    updatedAt: eventAt,
    ...overrides,
  };
}

describe('MemorySearchTimeline', () => {
  it('groups unique memories by Shanghai month and keeps card detail plus linked-copy labels', () => {
    const duplicate = memory('one', '2026-10-12T18:30:00+08:00', { longTermCopies: [{ id: 'copy-love', name: '恋爱长跑' }] });
    const html = renderToStaticMarkup(
      <MemorySearchTimeline items={[duplicate, duplicate, memory('two', '2026-09-03T09:15:00+08:00')]} loading={false} onLoadMore={() => undefined} onRetry={() => undefined} onSelect={() => undefined} />,
    );

    expect(html).toContain('2026年10月');
    expect(html).toContain('2026年9月');
    expect(html).toContain('2026年10月12日 18:30');
    expect(html).toContain('一起沿着海边散步');
    expect(html).toContain('开心');
    expect(html).toContain('恋爱长跑');
    expect((html.match(/id="memory-search-one"/g) ?? [])).toHaveLength(1);
  });

  it('shows a missing-image fallback, five-item continuation and back-to-top control', () => {
    const html = renderToStaticMarkup(
      <MemorySearchTimeline items={[memory('missing', '2026-10-01T10:00:00+08:00', { imageUrl: '' })]} loading={false} nextCursor="next" onLoadMore={() => undefined} onRetry={() => undefined} onSelect={() => undefined} />,
    );
    expect(html).toContain('照片暂时无法显示');
    expect(html).toContain('继续加载 5 条');
    expect(html).toContain('回到顶部');
  });

  it('keeps visible memories when an append request fails and offers retry', () => {
    const html = renderToStaticMarkup(
      <MemorySearchTimeline items={[memory('one', '2026-10-01T10:00:00+08:00')]} loading={false} error="网络不可用" onLoadMore={() => undefined} onRetry={() => undefined} onSelect={() => undefined} />,
    );
    expect(html).toContain('记忆 one');
    expect(html).toContain('网络不可用');
    expect(html).toContain('重试加载');
  });
});
