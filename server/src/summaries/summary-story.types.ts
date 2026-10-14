export type StoryPeriodType = 'MONTH' | 'YEAR';

export type SummaryRank = { name: string; count: number };

export interface SummaryStoryMemory {
  id: string;
  mediaId?: string;
  imageUrl?: string;
  storagePath?: string;
  title: string;
  note: string;
  mood: string;
  eventAt: string;
  statuses: string[];
  topics: string[];
  summaryExcluded: boolean;
  deletedAt: string | null;
}

export interface SummaryCopySnapshot {
  id: string;
  name: string;
  memoryCount: number;
  lifecycleStatus: string;
}

export interface SummarySnapshot {
  periodType: StoryPeriodType;
  periodKey: string;
  label: string;
  range: { start: string; end: string };
  memories: SummaryStoryMemory[];
  memoryCount: number;
  photoCount: number;
  recordedDays: number;
  topTopics: SummaryRank[];
  topMoods: SummaryRank[];
  topStatuses: SummaryRank[];
  longTermCopies: SummaryCopySnapshot[];
  allowText: boolean;
  allowPhotos: boolean;
  sourceHash: string;
  encouragement?: string;
}

export type SummaryPageType = 'COVER' | 'OVERVIEW' | 'MOOD' | 'MEMORY' | 'COPY' | 'SEASON' | 'QUOTE' | 'ORDINARY' | 'KEYWORD' | 'CLOSING' | 'REFLECTION';

export interface SummaryPageDraft {
  pageType: SummaryPageType;
  displayOrder: number;
  templateKey: string;
  narration: string;
  factRefs: string[];
  payload: Record<string, unknown>;
}

export interface StoryPlan {
  shouldGenerate: boolean;
  isCompact: boolean;
  pages: SummaryPageDraft[];
}

export interface LeadMoodResult {
  name: string;
  count: number;
  latestAt: string;
}
