export type Memory = {
  id: string;
  imageBlob: Blob;
  imageName: string;
  imageUrl?: string;
  mediaId?: string;
  eventAt: string;
  title: string;
  note: string;
  mood: string;
  statuses: string[];
  topicIds?: string[];
  topics?: Array<{ id: string; name: string }>;
  echoExcluded?: boolean;
  summaryExcluded?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemoryDraft = Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>;

export function searchMemories(memories: Memory[], query: string): Memory[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return memories;

  return memories.filter((memory) => {
    const searchable = [memory.title, memory.note, memory.mood, ...memory.statuses, ...(memory.topics ?? []).map((topic) => topic.name)]
      .join(' ')
      .toLocaleLowerCase();
    return searchable.includes(normalized);
  });
}

export function sortMemories(memories: Memory[]): Memory[] {
  return [...memories].sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime());
}
