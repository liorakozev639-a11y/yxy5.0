import { describe, expect, it } from 'vitest';
import { linkedMemories, toggleMemoryLink, type ImportantDay } from './important-day';
import type { Memory } from './memory';

const day: ImportantDay = { id: 'day-1', name: '我们第一次见面', date: '2026-10-15', memoryIds: ['one', 'deleted'], createdAt: '2026-01-01T00:00:00.000Z' };
const memories = (id: string): Memory => ({ id, imageBlob: new Blob(['x']), imageName: 'x.jpg', eventAt: '2026-01-01T00:00:00.000Z', title: id, note: '', mood: '', statuses: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

describe('important day rules', () => {
  it('links and unlinks a memory without duplicates', () => {
    const linked = toggleMemoryLink(day, 'two');
    expect(linked.memoryIds).toEqual(['one', 'deleted', 'two']);
    const unlinked = toggleMemoryLink(linked, 'one');
    expect(unlinked.memoryIds).toEqual(['deleted', 'two']);
    expect(toggleMemoryLink(unlinked, 'one').memoryIds).toEqual(['deleted', 'two', 'one']);
  });

  it('filters linked memory ids that no longer exist', () => {
    expect(linkedMemories(day, [memories('one')]).map((memory) => memory.id)).toEqual(['one']);
  });
});
