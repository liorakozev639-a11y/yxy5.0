import { describe, expect, it } from 'vitest';
import { dismissEcho, saveEchoReflection, shouldApplyMemoryReflections } from './memory-echo-state';
import { makeEcho } from '../test-utils/memory-echo';

describe('memory echo UI state', () => {
  it('adds a saved reflection to the matching echo without changing other echoes', () => {
    const echoes = [makeEcho({ id: 'echo-a' }), makeEcho({ id: 'echo-b' })];
    const reflection = { id: 'reflection-1', memoryId: 'memory-1', memoryEchoId: 'echo-b', sourceEchoDate: '2026-10-13', text: '现在的我更从容了', updatedAt: '2026-10-13T08:00:00.000Z' };
    const result = saveEchoReflection(echoes, 'echo-b', reflection);
    expect(result[0]).toBe(echoes[0]);
    expect(result[1].reflection?.text).toBe('现在的我更从容了');
  });

  it('marks only the dismissed echo as unavailable for today', () => {
    const echoes = [makeEcho({ id: 'echo-a' }), makeEcho({ id: 'echo-b' })];
    expect(dismissEcho(echoes, 'echo-a').map((echo) => echo.status)).toEqual(['DISMISSED', 'ACTIVE']);
  });

  it('rejects a stale reflection response after the selected memory changes', () => {
    expect(shouldApplyMemoryReflections('memory-a', 'memory-b')).toBe(false);
    expect(shouldApplyMemoryReflections('memory-b', 'memory-b')).toBe(true);
  });
});
