import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MemoryCard } from './MemoryCard';

describe('MemoryCard', () => {
  it('shows persisted title, mood, status and topic without a pending badge', () => {
    const html = renderToStaticMarkup(<MemoryCard imageUrl="/photo.jpg" memory={{
      id: 'memory-1', imageBlob: new Blob(), imageName: 'photo.jpg', eventAt: '2026-10-12T10:00:00.000Z',
      title: '海边散步', note: '', mood: '开心', statuses: ['散步'], topicIds: ['love'], topics: [{ id: 'love', name: '恋爱' }],
      createdAt: '2026-10-12T10:00:00.000Z', updatedAt: '2026-10-12T10:00:00.000Z',
    }} onClick={() => undefined} />);

    expect(html).toContain('海边散步');
    expect(html).toContain('开心');
    expect(html).toContain('散步');
    expect(html).toContain('恋爱');
    expect(html).not.toContain('待补充');
  });

  it('does not mark an empty memory as pending', () => {
    const html = renderToStaticMarkup(<MemoryCard imageUrl="/photo.jpg" memory={{
      id: 'memory-empty', imageBlob: new Blob(), imageName: 'photo.jpg', eventAt: '2026-10-12T10:00:00.000Z',
      title: '', note: '', mood: '', statuses: [], topicIds: [], topics: [],
      createdAt: '2026-10-12T10:00:00.000Z', updatedAt: '2026-10-12T10:00:00.000Z',
    }} onClick={() => undefined} />);
    expect(html).not.toContain('待补充');
  });
});
