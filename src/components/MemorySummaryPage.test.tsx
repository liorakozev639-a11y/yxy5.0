import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MemorySummary, SummaryListItem } from '../domain/memory-summary';
import { MemorySummaryPage } from './MemorySummaryPage';

const base: MemorySummary = {
  period: 'month', date: '2026-10-01', label: '2026年10月',
  range: { start: '2026-09-30T16:00:00.000Z', end: '2026-10-31T16:00:00.000Z' },
  memoryCount: 1, photoCount: 1, recordedDays: 1,
  topTopics: [{ name: '恋爱', count: 1 }], topMoods: [{ name: '开心', count: 1 }], topStatuses: [{ name: '散步', count: 1 }],
  representativeMemories: [{ id: 'memory-1', title: '海边散步', note: '风很温柔', mood: '开心', eventAt: '2026-10-12T04:00:00.000Z', mediaId: 'media-1', imageUrl: '/api/media/media-1/file' }],
  longTermCopies: [{ id: 'copy-1', name: '恋爱', memoryCount: 1, lifecycleStatus: 'ACTIVE' }],
};

describe('MemorySummaryPage', () => {
  it('shows monthly/yearly controls, facts, rankings and representative photo', () => {
    const html = renderToStaticMarkup(<MemorySummaryPage date="2026-10-01" onBack={() => undefined} onDateChange={() => undefined} onPeriodChange={() => undefined} period="month" summary={base} />);

    expect(html).toContain('月度总结');
    expect(html).toContain('年度总结');
    expect(html).toContain('2026年10月');
    expect(html).toContain('海边散步');
    expect(html).toContain('src="/api/media/media-1/file"');
    expect(html).toContain('长期副本进展');
  });

  it('renders a gentle empty state without invented conclusions', () => {
    const html = renderToStaticMarkup(<MemorySummaryPage date="2026-10-01" onBack={() => undefined} onDateChange={() => undefined} onPeriodChange={() => undefined} period="month" summary={{ ...base, memoryCount: 0, photoCount: 0, recordedDays: 0, topTopics: [], topMoods: [], topStatuses: [], representativeMemories: [], longTermCopies: [] }} />);

    expect(html).toContain('这个月还没有记忆');
    expect(html).not.toContain('你度过了精彩的一月');
  });

  it('can render the persistent summary archive instead of generating a live report', () => {
    const archived: SummaryListItem = {
      id: 'summary-1', periodType: 'MONTH', periodKey: '2026-09', status: 'READY', generationMode: 'TEMPLATE',
      isCompact: false, viewedAt: null, lastViewedPage: 0, version: 1, createdAt: '', generatedAt: '', updatedAt: '',
    };
    const html = renderToStaticMarkup(<MemorySummaryPage archive={{ filter: 'MONTH', summaries: [archived], reflections: [], onFilterChange: () => undefined, onOpen: () => undefined }} date="2026-10-01" onBack={() => undefined} onDateChange={() => undefined} onPeriodChange={() => undefined} period="month" />);

    expect(html).toContain('情绪电影档案馆');
    expect(html).toContain('2026年9月');
    expect(html).not.toContain('总结日期');
  });
});
