import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { decodeMemorySearchCursor, encodeMemorySearchCursor } from '../src/memories/memory-search-cursor.js';

describe('memory search cursor', () => {
  it('round trips the complete stable ordering tuple', () => {
    const value = { score: 3.25, eventAt: '2026-10-15T08:30:00.000Z', id: 'memory-b' };
    expect(decodeMemorySearchCursor(encodeMemorySearchCursor(value))).toEqual(value);
  });

  it('keeps the id when score and event time are tied', () => {
    const first = decodeMemorySearchCursor(encodeMemorySearchCursor({ score: 2, eventAt: '2026-10-15T08:30:00.000Z', id: 'memory-a' }));
    const second = decodeMemorySearchCursor(encodeMemorySearchCursor({ score: 2, eventAt: '2026-10-15T08:30:00.000Z', id: 'memory-b' }));
    expect(first.id).toBe('memory-a');
    expect(second.id).toBe('memory-b');
  });

  it.each(['not-base64-json', Buffer.from('{}').toString('base64url'), 'x'.repeat(1025)])('rejects malformed or oversized input', (cursor) => {
    expect(() => decodeMemorySearchCursor(cursor)).toThrow(BadRequestException);
  });
});
