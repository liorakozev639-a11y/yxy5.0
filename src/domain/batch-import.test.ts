import { describe, expect, it, vi } from 'vitest';
import { createBatchImportItems, failedBatchItems, runBatchImport } from './batch-import';

describe('batch import', () => {
  const file = (name: string) => new File([name], name, { type: 'image/jpeg' });

  it('saves every file with its resolved time, shared topic, and blank optional fields', async () => {
    const items = createBatchImportItems([file('one.jpg'), file('two.jpg')]);
    const saveOne = vi.fn(async (draft: any) => ({ ...draft, id: draft.imageName, createdAt: draft.eventAt, updatedAt: draft.eventAt }));
    const changes: string[] = [];

    const result = await runBatchImport(items, 'topic-love', saveOne, (item) => changes.push(`${item.file.name}:${item.status}`), async (current) => current.name === 'one.jpg' ? '2026-01-01T01:00:00.000Z' : '2026-01-02T01:00:00.000Z');

    expect(saveOne).toHaveBeenCalledTimes(2);
    expect(saveOne.mock.calls[0][0]).toMatchObject({ imageName: 'one.jpg', eventAt: '2026-01-01T01:00:00.000Z', title: '', note: '', mood: '', statuses: [], topicIds: ['topic-love'] });
    expect(result.map((item) => item.status)).toEqual(['success', 'success']);
    expect(changes).toEqual(['one.jpg:running', 'one.jpg:success', 'two.jpg:running', 'two.jpg:success']);
  });

  it('continues after one file fails and exposes only failed items for retry', async () => {
    const items = createBatchImportItems([file('bad.jpg'), file('good.jpg')]);
    const saveOne = vi.fn(async (draft: any) => {
      if (draft.imageName === 'bad.jpg') throw new Error('上传失败');
      return { ...draft, id: 'good', createdAt: draft.eventAt, updatedAt: draft.eventAt };
    });

    const result = await runBatchImport(items, undefined, saveOne, () => undefined, async () => '2026-01-01T01:00:00.000Z');

    expect(result.map((item) => item.status)).toEqual(['failed', 'success']);
    expect(result[0].error).toBe('上传失败');
    expect(failedBatchItems(result).map((item) => item.file.name)).toEqual(['bad.jpg']);
    expect(saveOne).toHaveBeenCalledTimes(2);
  });
});
