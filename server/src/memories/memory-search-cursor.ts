import { BadRequestException } from '@nestjs/common';

export type MemorySearchCursor = {
  score: number;
  eventAt: string;
  id: string;
};

const MAX_CURSOR_LENGTH = 1024;

export function encodeMemorySearchCursor(value: MemorySearchCursor): string {
  validateCursorValue(value);
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeMemorySearchCursor(cursor: string): MemorySearchCursor {
  if (!cursor || cursor.length > MAX_CURSOR_LENGTH) throw invalidCursor();
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const value = JSON.parse(decoded) as unknown;
    validateCursorValue(value);
    return value;
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw invalidCursor();
  }
}

function validateCursorValue(value: unknown): asserts value is MemorySearchCursor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidCursor();
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.score !== 'number'
    || !Number.isFinite(candidate.score)
    || typeof candidate.eventAt !== 'string'
    || Number.isNaN(new Date(candidate.eventAt).getTime())
    || typeof candidate.id !== 'string'
    || candidate.id.length === 0
    || candidate.id.length > 160
  ) {
    throw invalidCursor();
  }
}

function invalidCursor() {
  return new BadRequestException('搜索游标无效');
}
