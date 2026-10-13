import type { MemoryEcho } from '../domain/memory-echo';

export function makeEcho(overrides: Partial<MemoryEcho> = {}): MemoryEcho {
  return {
    id: 'echo-1',
    echoDate: '2026-10-13',
    type: 'ON_THIS_DAY',
    reason: '3年前的今天',
    score: 100,
    displayOrder: 1,
    status: 'ACTIVE',
    memoryAvailable: true,
    comparisonMemoryAvailable: false,
    memory: {
      id: 'memory-1',
      imageBlob: new Blob(),
      imageName: 'lake.jpg',
      imageUrl: '/lake.jpg',
      eventAt: '2023-10-13T04:00:00.000Z',
      title: '湖边的午后',
      note: '风很轻',
      mood: '开心',
      statuses: ['旅行'],
      topics: [{ id: 'topic-1', name: '恋爱' }],
      createdAt: '2023-10-13T04:00:00.000Z',
      updatedAt: '2023-10-13T04:00:00.000Z',
    },
    ...overrides,
  };
}
