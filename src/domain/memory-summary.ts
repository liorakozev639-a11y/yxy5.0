export type SummaryPeriod = 'month' | 'year';
export type SummaryRank = { name: string; count: number };
export type StoryPeriodType = 'MONTH' | 'YEAR';
export type SummaryGenerationStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
export type SummaryGenerationMode = 'AI' | 'TEMPLATE';
export type SummaryPageType = 'COVER' | 'OVERVIEW' | 'MOOD' | 'MEMORY' | 'COPY' | 'SEASON' | 'QUOTE' | 'ORDINARY' | 'KEYWORD' | 'CLOSING' | 'REFLECTION';

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

export type SummaryStoryPage = {
  id: string;
  summaryId: string;
  pageType: SummaryPageType;
  displayOrder: number;
  narration: string;
  originalNarration: string;
  payload: Record<string, unknown>;
  isUserEdited: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

export type SummaryReflection = {
  id: string;
  summaryId: string;
  userId: string;
  coverMediaId?: string | null;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type SummaryListItem = {
  id: string;
  periodType: StoryPeriodType;
  periodKey: string;
  status: SummaryGenerationStatus;
  generationMode: SummaryGenerationMode;
  isCompact: boolean;
  viewedAt: string | null;
  lastViewedPage: number;
  version: number;
  errorMessage?: string | null;
  createdAt: string;
  generatedAt: string | null;
  updatedAt: string;
};

export type MemoryStorySummary = SummaryListItem & {
  pages: SummaryStoryPage[];
  reflection: SummaryReflection | null;
};

export type SummaryPreference = {
  userId?: string;
  enabled: boolean;
  allowText: boolean;
  allowPhotos: boolean;
  allowCloudAi: boolean;
  reviewed: boolean;
  consentReviewedAt?: string | null;
};

export type DueSummaryResult = {
  needsConsent: boolean;
  due: SummaryListItem[];
  pendingPeriods: Array<{ periodType: StoryPeriodType; periodKey: string; label: string }>;
};

export type NoContentSummary = { status: 'NO_CONTENT'; periodType: StoryPeriodType; periodKey: string };

export function isReadySummary(summary: { status?: string } | null | undefined): summary is SummaryListItem {
  return summary?.status === 'READY';
}

export function nextReadablePage(summary: Pick<MemoryStorySummary, 'lastViewedPage' | 'pages'>): number {
  if (!summary.pages.length) return 0;
  return Math.min(Math.max(summary.lastViewedPage, 0), summary.pages.length - 1);
}

export function shouldShowDueSummary(result: DueSummaryResult): boolean {
  return !result.needsConsent && result.due.some((summary) => isReadySummary(summary) && !summary.viewedAt);
}
