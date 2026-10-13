import { describe, expect, it } from 'vitest';
import { appReducer, initialState, type AppState } from './app-state';
import type { Memory } from './domain/memory';

const record = (id: string, eventAt: string): Memory => ({
  id,
  imageBlob: new Blob(['photo'], { type: 'image/jpeg' }),
  imageName: `${id}.jpg`,
  eventAt,
  title: '',
  note: '',
  mood: '',
  statuses: [],
  createdAt: eventAt,
  updatedAt: eventAt,
});

describe('app state', () => {
  it('loads memories in reverse event-time order and clears loading', () => {
    const state = appReducer(initialState, {
      type: 'loaded',
      memories: [record('old', '2025-01-01T00:00:00.000Z'), record('new', '2026-01-01T00:00:00.000Z')],
    });

    expect(state.loading).toBe(false);
    expect(state.memories.map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('upserts a memory and removes the selected memory', () => {
    const saved: AppState = appReducer(initialState, { type: 'upserted', memory: record('one', '2026-01-01T00:00:00.000Z') });
    const selected = appReducer(saved, { type: 'selected', id: 'one' });
    const updated = appReducer(selected, { type: 'upserted', memory: { ...saved.memories[0], title: '晚风' } });
    expect(updated.memories[0].title).toBe('晚风');

    const removed = appReducer(updated, { type: 'removed', id: 'one' });
    expect(removed.memories).toHaveLength(0);
    expect(removed.selectedId).toBeUndefined();
  });

  it('upserts a batch of memories in one sorted state update', () => {
    const state = appReducer(initialState, { type: 'loaded', memories: [record('old', '2025-01-01T00:00:00.000Z')] });
    const next = appReducer(state, { type: 'upsertedMany', memories: [record('new', '2026-01-01T00:00:00.000Z'), record('older', '2024-01-01T00:00:00.000Z')] } as never);
    expect(next.memories.map((item) => item.id)).toEqual(['new', 'old', 'older']);
  });

  it('updates a memory echo exclusion setting without reloading the list', () => {
    const state = appReducer({ ...initialState, loading: false, memories: [record('one', '2026-01-01T00:00:00.000Z')] }, { type: 'echoSettingChanged', id: 'one', echoExcluded: true });
    expect(state.memories[0].echoExcluded).toBe(true);
  });
});
