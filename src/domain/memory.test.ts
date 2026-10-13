import { describe, expect, it } from 'vitest';
import { searchMemories, sortMemories, type Memory } from './memory';

const memory = (overrides: Partial<Memory>): Memory => ({
  id: overrides.id ?? crypto.randomUUID(),
  imageBlob: new Blob(['photo'], { type: 'image/jpeg' }),
  imageName: 'memory.jpg',
  eventAt: overrides.eventAt ?? '2026-10-12T10:00:00.000Z',
  title: overrides.title ?? '',
  note: overrides.note ?? '',
  mood: overrides.mood ?? '',
  statuses: overrides.statuses ?? [],
  topicIds: overrides.topicIds ?? [],
  topics: overrides.topics ?? [],
  createdAt: overrides.createdAt ?? '2026-10-12T10:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-10-12T10:00:00.000Z',
});

describe('memory domain rules', () => {
  it('searches title, note, mood, statuses, and topic names', () => {
    const memories = [
      memory({ id: 'title', title: '海边的下午' }),
      memory({ id: 'note', note: '风很温柔' }),
      memory({ id: 'mood', mood: '感动' }),
      memory({ id: 'status', statuses: ['约会'] }),
      memory({ id: 'topic', topics: [{ id: 'topic-exam', name: '考研' }] }),
    ];

    expect(searchMemories(memories, '海边').map((item) => item.id)).toEqual(['title']);
    expect(searchMemories(memories, '温柔').map((item) => item.id)).toEqual(['note']);
    expect(searchMemories(memories, '感动').map((item) => item.id)).toEqual(['mood']);
    expect(searchMemories(memories, '约会').map((item) => item.id)).toEqual(['status']);
    expect(searchMemories(memories, '考研').map((item) => item.id)).toEqual(['topic']);
  });

  it('sorts memories by event time descending', () => {
    const memories = [
      memory({ id: 'old', eventAt: '2024-01-01T10:00:00.000Z' }),
      memory({ id: 'new', eventAt: '2026-01-01T10:00:00.000Z' }),
    ];

    expect(sortMemories(memories).map((item) => item.id)).toEqual(['new', 'old']);
  });
});
