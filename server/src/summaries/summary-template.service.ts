import { Injectable } from '@nestjs/common';
import { moodOpening } from './summary-copy.js';
import { selectLeadMood } from './summary-story.domain.js';
import type { SummaryPageDraft, SummarySnapshot } from './summary-story.types.js';

@Injectable()
export class SummaryTemplateService {
  generate(snapshot: SummarySnapshot, pageDrafts: SummaryPageDraft[]): SummaryPageDraft[] {
    return pageDrafts
      .filter((page) => page.pageType !== 'COPY' || snapshot.longTermCopies.length > 0)
      .map((page) => ({ ...page, narration: this.narration(snapshot, page) }))
      .map((page, displayOrder) => ({ ...page, displayOrder }));
  }

  private narration(snapshot: SummarySnapshot, page: SummaryPageDraft): string {
    const leadMood = selectLeadMood(snapshot.memories);
    switch (page.pageType) {
      case 'COVER':
        return `你的${snapshot.label}记忆，已经整理好了。`;
      case 'OVERVIEW':
        return `这段时间，你留下了${snapshot.memoryCount}段记忆，在${snapshot.recordedDays}天里认真保存了生活。`;
      case 'MOOD':
        return leadMood ? moodOpening(leadMood.name, snapshot.label) : snapshot.encouragement ?? '你走过的每一天都算数。';
      case 'MEMORY':
        return `这些是你在${snapshot.label}认真留下的瞬间，它们让这一段生活有了可以回看的形状。`;
      case 'COPY': {
        const strongest = [...snapshot.longTermCopies].sort((left, right) => right.memoryCount - left.memoryCount)[0];
        return `关于${strongest.name}，你又留下了${strongest.memoryCount}段新的进展。`;
      }
      case 'SEASON':
        return `沿着季节往回看，你会发现时间把许多普通日子慢慢连成了故事。`;
      case 'QUOTE':
        return `这是你当时真正写下的话，也是那一刻最诚实的声音。`;
      case 'ORDINARY':
        return `你最常记录的并不一定是远方，而是那些认真度过的普通日子。`;
      case 'KEYWORD':
        return `这些词陪你走过了${snapshot.label}，也留下了属于你的生活线索。`;
      case 'CLOSING':
        return snapshot.topTopics.length
          ? `回头看，你围绕${snapshot.topTopics.map((item) => item.name).slice(0, 2).join('和')}留下了许多真实片段。`
          : `回头看，你已经把这一段生活认真保存了下来。`;
      case 'REFLECTION':
        return `现在，给未来的你留下一句话吧。`;
      default:
        return `这是属于你的真实记忆。`;
    }
  }
}
