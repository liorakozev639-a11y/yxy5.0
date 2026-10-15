export type MemorySearchSort = 'RELEVANCE' | 'NEWEST' | 'OLDEST';
export type MemorySearchMatchMode = 'EXACT' | 'FUZZY';

export type MemorySearchInput = {
  from?: string;
  to?: string;
  mood?: string;
  statusValues?: string[];
  topicIds?: string[];
  keywords?: string[];
  sort?: MemorySearchSort;
  matchMode?: MemorySearchMatchMode;
  cursor?: string;
  pageSize?: number;
};

export type MemorySearchItem = {
  id: string;
  userId: string;
  mediaId: string;
  imageUrl: string;
  title: string;
  note: string;
  mood: string;
  eventAt: Date;
  timezone: string;
  statuses: string[];
  topicIds: string[];
  topics: Array<{ id: string; name: string }>;
  longTermCopies: Array<{ id: string; name: string }>;
  createdAt: Date;
  updatedAt: Date;
  echoExcluded: boolean;
  summaryExcluded: boolean;
};

export type MemorySearchPage = {
  items: MemorySearchItem[];
  total: number;
  nextCursor?: string;
  relaxationSuggestions?: MemorySearchRelaxation[];
};

export type MemorySearchRelaxation = {
  field: 'from' | 'to' | 'mood' | 'status' | 'topic' | 'keyword';
  value: string;
  resultCount: number;
};
