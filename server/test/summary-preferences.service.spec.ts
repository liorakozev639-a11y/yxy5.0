import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { UpdateSummaryPreferenceDto } from '../src/summaries/summary.dto.js';
import { SummariesService } from '../src/summaries/summaries.service.js';

function makePrisma(existing: any = null) {
  let stored = existing;
  return {
    summaryPreference: {
      findUnique: vi.fn(async () => stored),
      upsert: vi.fn(async ({ create, update }: any) => {
        stored = stored ? { ...stored, ...update, updatedAt: new Date() } : { ...create, createdAt: new Date(), updatedAt: new Date() };
        return stored;
      }),
    },
  } as any;
}

describe('summary privacy preferences', () => {
  it('returns private-by-default cloud consent without creating a database row', async () => {
    const prisma = makePrisma();
    const service = new SummariesService(prisma);

    await expect(service.getPreferences('local-user')).resolves.toEqual({
      userId: 'local-user',
      enabled: true,
      allowText: true,
      allowPhotos: true,
      allowCloudAi: false,
      reviewed: false,
      consentReviewedAt: null,
    });
    expect(prisma.summaryPreference.upsert).not.toHaveBeenCalled();
  });

  it('requires an explicit reviewed flag before enabling cloud AI', async () => {
    const service = new SummariesService(makePrisma());

    await expect(service.updatePreferences('local-user', { allowCloudAi: true })).rejects.toThrow(/授权/);
  });

  it('upserts independently controlled text and photo consent after review', async () => {
    const prisma = makePrisma();
    const service = new SummariesService(prisma);

    const result = await service.updatePreferences('local-user', {
      reviewed: true,
      allowCloudAi: true,
      allowText: false,
      allowPhotos: true,
    });

    expect(result).toMatchObject({ allowCloudAi: true, allowText: false, allowPhotos: true, reviewed: true });
    expect(result.consentReviewedAt).toBeInstanceOf(Date);
  });

  it('rejects non-boolean preference values at the DTO boundary', async () => {
    const input = Object.assign(new UpdateSummaryPreferenceDto(), { reviewed: true, allowPhotos: 'yes' });
    const errors = await validate(input);

    expect(errors.some((error) => error.property === 'allowPhotos')).toBe(true);
  });
});
