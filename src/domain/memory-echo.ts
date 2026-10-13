import type { Memory } from './memory';

export type MemoryEchoType = 'ON_THIS_DAY' | 'COPY_ANNIVERSARY' | 'COPY_MILESTONE' | 'COPY_FIRST' | 'PAST_AND_NOW' | 'TOPIC_MEMORY';
export type MemoryEchoStatus = 'ACTIVE' | 'DISMISSED';

export type EchoReflection = {
  id: string;
  memoryId: string;
  memoryEchoId?: string | null;
  sourceEchoDate: string;
  text: string;
  createdAt?: string;
  updatedAt: string;
};

export type MemoryEcho = {
  id: string;
  echoDate: string;
  type: MemoryEchoType;
  reason: string;
  score: number;
  displayOrder: number;
  status: MemoryEchoStatus;
  longTermCopyId?: string;
  sourceTopic?: { id: string; name: string };
  memoryAvailable: boolean;
  memory?: Memory;
  comparisonMemoryAvailable: boolean;
  comparisonMemory?: Memory;
  reflection?: EchoReflection;
  viewedAt?: string | null;
  createdAt?: string;
};

export type EchoPreference = {
  userId: string;
  enabled: boolean;
  excludedMoods: string[];
};

export type EchoPreferenceUpdate = Partial<Pick<EchoPreference, 'enabled' | 'excludedMoods'>>;
