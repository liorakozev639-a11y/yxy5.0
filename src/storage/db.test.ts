import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryRepository } from './db';

describe('memory repository', () => {
  const dbName = `photo-memory-test-${Math.random()}`;
  const repository = createMemoryRepository(dbName);

  beforeEach(async () => {
    await repository.clear();
  });

  it('persists, updates, lists, and removes a memory with its Blob', async () => {
    const now = new Date().toISOString();
    const created = await repository.put({
      id: 'memory-1',
      imageBlob: new Blob(['image-data'], { type: 'image/jpeg' }),
      imageName: 'walk.jpg',
      eventAt: now,
      title: '',
      note: '',
      mood: '',
      statuses: [],
      createdAt: now,
      updatedAt: now,
    });

    expect(created.id).toBe('memory-1');
    expect(await repository.getAll()).toHaveLength(1);
    expect(await (await repository.get('memory-1'))?.imageBlob.text()).toBe('image-data');

    await repository.put({ ...created, title: '补充后的标题', updatedAt: new Date().toISOString() });
    expect((await repository.get('memory-1'))?.title).toBe('补充后的标题');

    await repository.remove('memory-1');
    expect(await repository.get('memory-1')).toBeUndefined();
  });
});
