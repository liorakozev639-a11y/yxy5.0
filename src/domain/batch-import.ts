import type { Memory, MemoryDraft } from './memory';
import { readCaptureDate } from '../storage/image-metadata';

export type BatchImportStatus = 'pending' | 'running' | 'success' | 'failed';

export type BatchImportItem = {
  id: string;
  file: File;
  status: BatchImportStatus;
  eventAt?: string;
  memory?: Memory;
  error?: string;
};

export type BatchSaveOne = (draft: MemoryDraft) => Promise<Memory>;
export type CaptureDateReader = (file: File) => Promise<string>;

export function createBatchImportItems(files: File[]): BatchImportItem[] {
  return files.map((file, index) => ({ id: `${index}-${file.name}-${file.lastModified}`, file, status: 'pending' }));
}

export function failedBatchItems(items: BatchImportItem[]) {
  return items.filter((item) => item.status === 'failed');
}

export async function resolveBatchDates(items: BatchImportItem[], readDate: CaptureDateReader = readCaptureDate) {
  return Promise.all(items.map(async (item) => ({ ...item, eventAt: item.eventAt ?? await readDate(item.file) })));
}

export async function runBatchImport(
  items: BatchImportItem[],
  topicId: string | undefined,
  saveOne: BatchSaveOne,
  onItemChange: (item: BatchImportItem) => void,
  readDate: CaptureDateReader = readCaptureDate,
): Promise<BatchImportItem[]> {
  const results: BatchImportItem[] = [];
  for (const item of items) {
    const eventAt = item.eventAt ?? await readDate(item.file);
    const running: BatchImportItem = { ...item, eventAt, status: 'running', error: undefined, memory: undefined };
    onItemChange(running);
    try {
      const memory = await saveOne({
        imageBlob: item.file,
        imageName: item.file.name,
        eventAt,
        title: '',
        note: '',
        mood: '',
        statuses: [],
        topicIds: topicId ? [topicId] : [],
      });
      const success: BatchImportItem = { ...running, status: 'success', memory };
      results.push(success);
      onItemChange(success);
    } catch (saveError) {
      const failed: BatchImportItem = { ...running, status: 'failed', error: saveError instanceof Error ? saveError.message : '导入失败' };
      results.push(failed);
      onItemChange(failed);
    }
  }
  return results;
}
