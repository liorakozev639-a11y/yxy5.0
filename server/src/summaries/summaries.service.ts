import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SummaryAiAdapter } from './summary-ai.adapter.js';
import { buildMemorySummary, getSummaryRange, type SummaryPeriod } from './summary.domain.js';
import type {
  GenerateSummaryInput,
  SaveSummaryReflectionInput,
  SummaryPreferenceInput,
  UpdateSummaryPageInput,
  UpdateSummaryProgressInput,
} from './summary.dto.js';
import { SummarySnapshotService } from './summary-snapshot.service.js';
import { buildStoryPlan, getPreviousPeriod } from './summary-story.domain.js';
import type { StoryPeriodType, SummaryPageDraft, SummarySnapshot, SummaryStoryMemory } from './summary-story.types.js';
import { SummaryTemplateService } from './summary-template.service.js';
import { SummaryValidationService } from './summary-validation.service.js';

@Injectable()
export class SummariesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly snapshotService?: SummarySnapshotService,
    @Optional() private readonly templateService?: SummaryTemplateService,
    @Optional() private readonly aiAdapter?: SummaryAiAdapter,
    @Optional() private readonly validationService?: SummaryValidationService,
  ) {}

  /** Legacy on-demand statistics kept until the frontend migration is complete. */
  async get(userId: string, period: SummaryPeriod, date: string) {
    let range: ReturnType<typeof getSummaryRange>;
    try { range = getSummaryRange(period, date); } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : '日期无效');
    }

    const [memories, copies] = await Promise.all([
      this.prisma.memory.findMany({
        where: { userId, deletedAt: null, eventAt: { gte: range.start, lt: range.end } },
        include: { topics: { include: { topic: true } } },
        orderBy: [{ eventAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.longTermCopy.findMany({
        where: { userId, startDate: { lt: range.end }, lifecycleStatus: { not: 'ARCHIVED' } },
        include: { memoryLinks: { where: { memory: { deletedAt: null, eventAt: { gte: range.start, lt: range.end } } } } },
      }),
    ]);

    return buildMemorySummary(
      period,
      date,
      memories.map((memory) => ({
        id: memory.id,
        mediaId: memory.mediaId,
        title: memory.title,
        note: memory.note,
        mood: memory.mood,
        eventAt: memory.eventAt,
        statuses: memory.statuses,
        topics: memory.topics.map(({ topic }) => ({ id: topic.id, name: topic.name, isNone: topic.isNone })),
      })),
      copies.map((copy) => ({ id: copy.id, name: copy.name, lifecycleStatus: copy.lifecycleStatus, memoryCount: copy.memoryLinks.length })),
    );
  }

  async checkDue(userId: string, now: Date) {
    const preference = await this.getPreferences(userId);
    const periods = [getPreviousPeriod(now, 'MONTH'), getPreviousPeriod(now, 'YEAR')];
    if (!preference.reviewed) return { needsConsent: true, due: [], pendingPeriods: periods };
    if (!preference.enabled) return { needsConsent: false, due: [], pendingPeriods: [] };

    const generated = await Promise.all(periods.map((period) => this.generate(userId, period)));
    const due = generated.filter((item: any) => item.status === 'READY' && !item.viewedAt);
    return { needsConsent: false, due, pendingPeriods: [] };
  }

  async generate(userId: string, input: GenerateSummaryInput, force = false): Promise<any> {
    this.assertPeriod(input.periodType, input.periodKey);
    let summary = await this.prisma.memorySummary.findUnique({
      where: { userId_periodType_periodKey: { userId, periodType: input.periodType, periodKey: input.periodKey } },
    });
    if (summary && !force && ['PENDING', 'GENERATING', 'READY'].includes(summary.status)) {
      return this.summaryView(summary);
    }

    if (!summary) {
      try {
        summary = await this.prisma.memorySummary.create({
          data: {
            userId,
            periodType: input.periodType,
            periodKey: input.periodKey,
            status: 'GENERATING',
            sourceSnapshot: {},
            sourceHash: '',
            generationMode: 'TEMPLATE',
          },
        });
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
        const concurrent = await this.prisma.memorySummary.findUnique({
          where: { userId_periodType_periodKey: { userId, periodType: input.periodType, periodKey: input.periodKey } },
        });
        if (!concurrent) throw error;
        return this.summaryView(concurrent);
      }
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.memorySummaryPage.deleteMany({ where: { summaryId: summary!.id } });
        summary = await tx.memorySummary.update({
          where: { id: summary!.id },
          data: { status: 'GENERATING', errorMessage: null, version: { increment: 1 } },
        });
      });
    }

    try {
      const preference = await this.getPreferences(userId);
      const snapshotBuilder = this.snapshotService ?? new SummarySnapshotService(this.prisma);
      const snapshot = await snapshotBuilder.create(userId, input.periodType, input.periodKey, {
        allowText: preference.allowText,
        allowPhotos: preference.allowPhotos,
      });
      if (!snapshot) {
        await this.prisma.memorySummary.delete({ where: { id: summary.id } });
        return { status: 'NO_CONTENT', periodType: input.periodType, periodKey: input.periodKey };
      }

      const plan = buildStoryPlan(snapshot);
      if (!plan.shouldGenerate) {
        await this.prisma.memorySummary.delete({ where: { id: summary.id } });
        return { status: 'NO_CONTENT', periodType: input.periodType, periodKey: input.periodKey };
      }
      const template = this.templateService ?? new SummaryTemplateService();
      const localPages = template.generate(snapshot, plan.pages);
      let pages = localPages;
      let generationMode: 'AI' | 'TEMPLATE' = 'TEMPLATE';

      if (preference.reviewed && preference.allowCloudAi) {
        const ai = this.aiAdapter ?? new SummaryAiAdapter();
        const validator = this.validationService ?? new SummaryValidationService();
        const candidate = validator.validate(await ai.generate({ snapshot, pages: localPages }), snapshot, localPages);
        if (candidate.ok) {
          pages = localPages.map((page, index) => ({
            ...page,
            narration: candidate.pages[index].narration,
            factRefs: candidate.pages[index].factRefs,
          }));
          generationMode = 'AI';
        }
      }

      const storedPages = pages.map((page) => this.pageData(summary!.id, page, snapshot));
      await this.prisma.$transaction(async (tx) => {
        await tx.memorySummaryPage.deleteMany({ where: { summaryId: summary!.id } });
        await tx.memorySummaryPage.createMany({ data: storedPages });
        summary = await tx.memorySummary.update({
          where: { id: summary!.id },
          data: {
            status: 'READY',
            sourceSnapshot: snapshot as any,
            sourceHash: snapshot.sourceHash,
            generationMode,
            isCompact: plan.isCompact,
            generatedAt: new Date(),
            errorMessage: null,
            version: { increment: 1 },
          },
        });
      });
      return this.summaryView(summary);
    } catch (error) {
      await this.prisma.memorySummary.update({
        where: { id: summary.id },
        data: { status: 'FAILED', errorMessage: safeError(error), version: { increment: 1 } },
      }).catch(() => undefined);
      throw error;
    }
  }

  async list(userId: string, filter: { periodType?: StoryPeriodType }) {
    const rows = await this.prisma.memorySummary.findMany({
      where: { userId, ...(filter.periodType ? { periodType: filter.periodType } : {}) },
      orderBy: [{ periodKey: 'desc' }, { createdAt: 'desc' }],
    });
    return Promise.all(rows.map((row) => this.summaryView(row, false)));
  }

  async getById(userId: string, id: string) {
    const summary = await this.prisma.memorySummary.findFirst({ where: { id, userId } });
    if (!summary) throw new NotFoundException('总结不存在');
    return this.summaryView(summary);
  }

  async updateProgress(userId: string, id: string, input: UpdateSummaryProgressInput) {
    const result = await this.prisma.memorySummary.updateMany({
      where: { id, userId, version: input.version },
      data: {
        lastViewedPage: input.page,
        ...(input.viewed ? { viewedAt: new Date() } : {}),
        version: { increment: 1 },
      },
    });
    if (!result.count) await this.throwMissingOrConflict(userId, id);
    return this.getById(userId, id);
  }

  async updatePage(userId: string, summaryId: string, pageId: string, input: UpdateSummaryPageInput) {
    const summary = await this.prisma.memorySummary.findFirst({ where: { id: summaryId, userId } });
    if (!summary) throw new NotFoundException('总结不存在');
    const current = await this.prisma.memorySummaryPage.findFirst({ where: { id: pageId, summaryId } });
    if (!current) throw new NotFoundException('总结页面不存在');
    if (current.version !== input.version) throw new ConflictException('页面已被更新，请重新加载');
    if (input.payload) await this.assertOwnedMedia(userId, input.payload);

    const data: any = {
      ...(input.narration === undefined ? {} : { narration: input.narration.trim() }),
      ...(input.payload === undefined ? {} : { payload: sanitizeValue(input.payload) }),
      ...(input.displayOrder === undefined ? {} : { displayOrder: input.displayOrder }),
      isUserEdited: true,
      version: { increment: 1 },
    };
    let count = 0;
    await this.prisma.$transaction(async (tx) => {
      const target = input.displayOrder === undefined || input.displayOrder === current.displayOrder
        ? null
        : await tx.memorySummaryPage.findFirst({ where: { summaryId, displayOrder: input.displayOrder } });
      if (target && target.id !== pageId) await tx.memorySummaryPage.update({ where: { id: target.id }, data: { displayOrder: -1 } });
      const result = await tx.memorySummaryPage.updateMany({ where: { id: pageId, version: input.version }, data });
      count = result.count;
      if (!count) throw new ConflictException('页面已被更新，请重新加载');
      if (target && target.id !== pageId) {
        await tx.memorySummaryPage.update({ where: { id: target.id }, data: { displayOrder: current.displayOrder, version: { increment: 1 } } });
      }
    });
    if (!count) throw new ConflictException('页面已被更新，请重新加载');
    const updated = await this.prisma.memorySummaryPage.findFirst({ where: { id: pageId, summaryId } });
    return sanitizeValue(updated);
  }

  async regenerate(userId: string, id: string) {
    const summary = await this.prisma.memorySummary.findFirst({ where: { id, userId } });
    if (!summary) throw new NotFoundException('总结不存在');
    return this.generate(userId, { periodType: summary.periodType, periodKey: summary.periodKey }, true);
  }

  async saveReflection(userId: string, summaryId: string, input: SaveSummaryReflectionInput) {
    const summary = await this.prisma.memorySummary.findFirst({ where: { id: summaryId, userId } });
    if (!summary) throw new NotFoundException('总结不存在');
    const text = input.text.trim();
    if (!text) throw new BadRequestException('感言不能为空');
    if (input.coverMediaId) {
      const media = await this.prisma.mediaAsset.findFirst({ where: { id: input.coverMediaId, userId } });
      if (!media) throw new BadRequestException('封面照片不存在');
    }
    return this.prisma.summaryReflection.upsert({
      where: { summaryId },
      create: { summaryId, userId, text, coverMediaId: input.coverMediaId },
      update: { text, coverMediaId: input.coverMediaId },
    });
  }

  async remove(userId: string, id: string) {
    const summary = await this.prisma.memorySummary.findFirst({ where: { id, userId } });
    if (!summary) throw new NotFoundException('总结不存在');
    await this.prisma.memorySummary.delete({ where: { id } });
    return { ok: true };
  }

  async getPreferences(userId: string) {
    const preference = await this.prisma.summaryPreference.findUnique({ where: { userId } });
    if (!preference) {
      return {
        userId,
        enabled: true,
        allowText: true,
        allowPhotos: true,
        allowCloudAi: false,
        reviewed: false,
        consentReviewedAt: null,
      };
    }
    return this.preferenceView(preference);
  }

  async updatePreferences(userId: string, input: SummaryPreferenceInput) {
    if (input.reviewed !== true) throw new BadRequestException('请先确认总结与云端 AI 授权');
    const consentReviewedAt = new Date();
    const preference = await this.prisma.summaryPreference.upsert({
      where: { userId },
      create: {
        userId,
        enabled: input.enabled ?? true,
        allowText: input.allowText ?? true,
        allowPhotos: input.allowPhotos ?? true,
        allowCloudAi: input.allowCloudAi ?? false,
        consentReviewedAt,
      },
      update: {
        ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        ...(input.allowText === undefined ? {} : { allowText: input.allowText }),
        ...(input.allowPhotos === undefined ? {} : { allowPhotos: input.allowPhotos }),
        ...(input.allowCloudAi === undefined ? {} : { allowCloudAi: input.allowCloudAi }),
        consentReviewedAt,
      },
    });
    return this.preferenceView(preference);
  }

  private async summaryView(summary: any, includePages = true) {
    const [pages, reflection] = includePages
      ? await Promise.all([
        this.prisma.memorySummaryPage.findMany({ where: { summaryId: summary.id }, orderBy: { displayOrder: 'asc' } }),
        this.prisma.summaryReflection.findUnique({ where: { summaryId: summary.id } }),
      ])
      : [undefined, undefined];
    const { sourceSnapshot: _sourceSnapshot, ...publicSummary } = summary;
    return sanitizeValue({ ...publicSummary, ...(includePages ? { pages, reflection } : {}) });
  }

  private pageData(summaryId: string, page: SummaryPageDraft, snapshot: SummarySnapshot) {
    const memoryIds = Array.isArray(page.payload.memoryIds) ? page.payload.memoryIds.filter((id): id is string => typeof id === 'string') : [];
    const memories = memoryIds
      .map((id) => snapshot.memories.find((memory) => memory.id === id))
      .filter((memory): memory is SummaryStoryMemory => Boolean(memory))
      .map(publicMemory);
    const payload = sanitizeValue({ ...page.payload, ...(page.pageType === 'MEMORY' || page.pageType === 'QUOTE' ? { memories } : {}) });
    return {
      summaryId,
      pageType: page.pageType,
      displayOrder: page.displayOrder,
      narration: page.narration,
      originalNarration: page.narration,
      payload,
    };
  }

  private assertPeriod(periodType: StoryPeriodType, periodKey: string) {
    const valid = periodType === 'MONTH' ? /^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey) : /^\d{4}$/.test(periodKey);
    if (!valid) throw new BadRequestException('总结周期无效');
  }

  private async throwMissingOrConflict(userId: string, id: string): Promise<never> {
    const exists = await this.prisma.memorySummary.findFirst({ where: { id, userId } });
    if (!exists) throw new NotFoundException('总结不存在');
    throw new ConflictException('总结已被更新，请重新加载');
  }

  private async assertOwnedMedia(userId: string, payload: Record<string, unknown>) {
    const mediaIds = collectMediaIds(payload);
    for (const id of mediaIds) {
      const media = await this.prisma.mediaAsset.findFirst({ where: { id, userId } });
      if (!media) throw new BadRequestException('页面包含无效照片');
    }
  }

  private preferenceView(preference: {
    userId: string;
    enabled: boolean;
    allowText: boolean;
    allowPhotos: boolean;
    allowCloudAi: boolean;
    consentReviewedAt: Date | null;
  }) {
    return { ...preference, reviewed: Boolean(preference.consentReviewedAt) };
  }
}

function publicMemory(memory: SummaryStoryMemory) {
  const { storagePath: _storagePath, summaryExcluded: _summaryExcluded, deletedAt: _deletedAt, ...safe } = memory;
  return safe;
}

function sanitizeValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item)) as T;
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== 'storagePath' && key !== 'sourceSnapshot')
    .map(([key, item]) => [key, sanitizeValue(item)])) as T;
}

function collectMediaIds(value: unknown, key = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => collectMediaIds(item, key));
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' && ['mediaId', 'coverMediaId', 'selectedMediaId'].includes(key) ? [value] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([childKey, child]) => collectMediaIds(child, childKey));
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : '总结生成失败';
  return message.replace(/[A-Za-z]:\\[^\s]+/g, '[local-path]').slice(0, 500);
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'P2002');
}
