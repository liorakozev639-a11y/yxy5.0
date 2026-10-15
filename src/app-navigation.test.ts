import { describe, expect, it, vi } from 'vitest';
import { APP_NAV_ITEMS, APP_SUMMARY_ENTRY_LABEL, canAccessProtectedMemoryContent, restoreMemorySearchScroll, searchRefreshToast } from './App';

describe('app navigation', () => {
  it('keeps memory echo outside the four-item bottom navigation', () => {
    expect(APP_NAV_ITEMS.map((item) => item.label)).toEqual(['记忆', '记忆寻迹', '长期副本', '重要日子']);
    expect(APP_SUMMARY_ENTRY_LABEL).toBe('情绪电影');
    expect(APP_NAV_ITEMS.some((item) => String(item.label) === APP_SUMMARY_ENTRY_LABEL)).toBe(false);
  });

  it('never exposes protected memory-search content while the enabled app lock is locked', () => {
    expect(canAccessProtectedMemoryContent({ configured: true, enabled: true, locked: true, autoLockMinutes: 30 }, false)).toBe(false);
    expect(canAccessProtectedMemoryContent({ configured: true, enabled: true, locked: false, autoLockMinutes: 30 }, false)).toBe(true);
  });

  it('restores the selected result as the scroll anchor when closing detail', () => {
    const scrollIntoView = vi.fn();
    expect(restoreMemorySearchScroll('memory-1', () => ({ scrollIntoView }))).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('distinguishes a still-matching edit from one removed by the active criteria', () => {
    expect(searchRefreshToast('saved', 'memory-1', [{ id: 'memory-1' }])).toContain('已经更新');
    expect(searchRefreshToast('saved', 'memory-1', [])).toContain('不再符合当前寻迹条件');
    expect(searchRefreshToast('deleted', 'memory-1', [])).toContain('已删除');
  });
});
