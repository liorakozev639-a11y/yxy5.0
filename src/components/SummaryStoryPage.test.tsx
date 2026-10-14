import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SummaryStoryPage as StoryPage } from '../domain/memory-summary';
import { SummaryStoryPage } from './SummaryStoryPage';

const page = (pageType: StoryPage['pageType'], payload: Record<string, unknown> = {}, narration = '你认真走过了这段时间。'): StoryPage => ({
  id: `page-${pageType}`, summaryId: 'summary-1', pageType, displayOrder: 0, narration, originalNarration: narration,
  payload, isUserEdited: false, version: 1,
});

describe('SummaryStoryPage', () => {
  it.each([
    ['COVER', { label: '2026年9月' }, '2026年9月'],
    ['OVERVIEW', { memoryCount: 8, photoCount: 9, recordedDays: 6 }, '8'],
    ['MOOD', { leadMood: { name: '开心', count: 4 } }, '开心'],
    ['COPY', { copies: [{ id: 'copy-1', name: '考研', memoryCount: 12 }] }, '考研'],
    ['SEASON', { season: '春' }, '春'],
    ['REFLECTION', {}, '写给未来'],
  ] as const)('renders the %s story page', (pageType, payload, expected) => {
    const html = renderToStaticMarkup(<SummaryStoryPage page={page(pageType, payload)} />);
    expect(html).toContain(expected);
    expect(html).toContain('你认真走过了这段时间');
  });

  it('renders representative photos with alt text and visually separates original writing from narration', () => {
    const html = renderToStaticMarkup(<SummaryStoryPage page={page('MEMORY', { memories: [{ id: 'memory-1', mediaId: 'media-1', imageUrl: '/api/media/media-1/file', title: '海边散步', note: '风很温柔', mood: '开心', eventAt: '2026-09-02T00:00:00.000Z', statuses: [], topics: [] }] })} />);
    expect(html).toContain('alt="海边散步"');
    expect(html).toContain('src="/api/media/media-1/file"');
    expect(html).toContain('你当时写下');
    expect(html).toContain('风很温柔');
  });

  it('marks quoted user text as original content', () => {
    const html = renderToStaticMarkup(<SummaryStoryPage page={page('QUOTE', { memories: [{ id: 'memory-1', title: '', note: '今天终于不再害怕了', imageUrl: '', eventAt: '', mood: '', statuses: [], topics: [] }] })} />);
    expect(html).toContain('来自你的原文');
    expect(html).toContain('今天终于不再害怕了');
  });
});
