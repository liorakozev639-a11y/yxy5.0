import { describe, expect, it } from 'vitest';
import { daysFromToday } from './date';

describe('date domain rules', () => {
  it('calculates natural-day distance from a reference date', () => {
    expect(daysFromToday('2026-10-12', new Date('2026-10-12T18:30:00+08:00'))).toBe(0);
    expect(daysFromToday('2026-10-15', new Date('2026-10-12T18:30:00+08:00'))).toBe(3);
    expect(daysFromToday('2026-10-08', new Date('2026-10-12T18:30:00+08:00'))).toBe(-4);
  });
});
