import { Injectable } from '@nestjs/common';
import type { SummaryAiResult, SummaryPageDraft, SummarySnapshot } from './summary-story.types.js';

@Injectable()
export class SummaryValidationService {
  validate(result: SummaryAiResult, snapshot: SummarySnapshot, plan: SummaryPageDraft[]): SummaryAiResult {
    if (!result.ok) return result;
    if (result.pages.length !== plan.length) return { ok: false, reason: 'PAGE_STRUCTURE' };
    const knownFacts = factCatalog(snapshot);
    const allowedNumbers = numberCatalog(snapshot);
    for (let index = 0; index < plan.length; index += 1) {
      const expected = plan[index];
      const actual = result.pages[index];
      if (actual.displayOrder !== expected.displayOrder || actual.pageType !== expected.pageType || !actual.narration.trim() || !actual.narration.includes('你')) {
        return { ok: false, reason: 'PAGE_STRUCTURE' };
      }
      const plannedFacts = new Set(expected.factRefs);
      if (actual.factRefs.some((fact) => !knownFacts.has(fact) || !plannedFacts.has(fact))) return { ok: false, reason: 'UNKNOWN_FACT' };
      const numbers = actual.narration.match(/\d+/g)?.map(Number) ?? [];
      if (numbers.some((number) => !allowedNumbers.has(number))) return { ok: false, reason: 'UNKNOWN_NUMBER' };
    }
    return result;
  }
}

function factCatalog(snapshot: SummarySnapshot): Set<string> {
  return new Set([
    'memoryCount', 'photoCount', 'recordedDays',
    ...snapshot.memories.map((memory) => `memory:${memory.id}`),
    ...snapshot.topMoods.map((item) => `mood:${item.name}`),
    ...snapshot.topTopics.map((item) => `topic:${item.name}`),
    ...snapshot.topStatuses.map((item) => `status:${item.name}`),
    ...snapshot.longTermCopies.map((copy) => `copy:${copy.id}`),
  ]);
}

function numberCatalog(snapshot: SummarySnapshot): Set<number> {
  const periodNumbers = snapshot.periodKey.split('-').map(Number);
  return new Set([
    0,
    snapshot.memoryCount,
    snapshot.photoCount,
    snapshot.recordedDays,
    ...periodNumbers,
    ...snapshot.topMoods.map((item) => item.count),
    ...snapshot.topTopics.map((item) => item.count),
    ...snapshot.topStatuses.map((item) => item.count),
    ...snapshot.longTermCopies.map((copy) => copy.memoryCount),
  ]);
}
