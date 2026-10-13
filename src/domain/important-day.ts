import type { Memory } from './memory';

export type ImportantDay = {
  id: string;
  name: string;
  date: string;
  memoryIds: string[];
  createdAt: string;
};

export function toggleMemoryLink(day: ImportantDay, memoryId: string): ImportantDay {
  const memoryIds = day.memoryIds.includes(memoryId)
    ? day.memoryIds.filter((id) => id !== memoryId)
    : [...day.memoryIds, memoryId];
  return { ...day, memoryIds };
}

export function linkedMemories(day: ImportantDay, memories: Memory[]): Memory[] {
  const memoryMap = new Map(memories.map((memory) => [memory.id, memory]));
  return day.memoryIds.flatMap((id) => {
    const memory = memoryMap.get(id);
    return memory ? [memory] : [];
  });
}
