export type SummaryPeriod = 'month' | 'year';
export type SummaryRank = { name: string; count: number };

export type MemorySummary = {
  period: SummaryPeriod;
  date: string;
  label: string;
  range: { start: string; end: string };
  memoryCount: number;
  photoCount: number;
  recordedDays: number;
  topTopics: SummaryRank[];
  topMoods: SummaryRank[];
  topStatuses: SummaryRank[];
  representativeMemories: Array<{
    id: string;
    title: string;
    note: string;
    mood: string;
    eventAt: string;
    mediaId: string;
    imageUrl: string;
  }>;
  longTermCopies: Array<{ id: string; name: string; memoryCount: number; lifecycleStatus: string }>;
};
