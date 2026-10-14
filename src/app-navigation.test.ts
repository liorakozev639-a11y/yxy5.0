import { describe, expect, it } from 'vitest';
import { APP_NAV_ITEMS, APP_SUMMARY_ENTRY_LABEL } from './App';

describe('app navigation', () => {
  it('keeps memory echo outside the four-item bottom navigation', () => {
    expect(APP_NAV_ITEMS.map((item) => item.label)).toEqual(['记忆', '时间线', '长期副本', '重要日子']);
    expect(APP_SUMMARY_ENTRY_LABEL).toBe('情绪电影');
    expect(APP_NAV_ITEMS.some((item) => String(item.label) === APP_SUMMARY_ENTRY_LABEL)).toBe(false);
  });
});
