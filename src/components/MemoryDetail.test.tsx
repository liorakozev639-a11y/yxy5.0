import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MemoryDetail } from './MemoryDetail';
import { makeEcho } from '../test-utils/memory-echo';

describe('MemoryDetail', () => {
  it('shows saved echo reflections without replacing the original note', () => {
    const memory = makeEcho().memory!;
    const html = renderToStaticMarkup(<MemoryDetail imageUrl="/lake.jpg" memory={memory} onClose={() => undefined} onDelete={() => undefined} onEdit={() => undefined} reflections={[{ id: 'reflection-1', memoryId: memory.id, sourceEchoDate: '2026-10-13', text: '现在的我更从容了', updatedAt: '2026-10-13T08:00:00.000Z' }]} />);
    expect(html).toContain('风很轻');
    expect(html).toContain('回声感言');
    expect(html).toContain('现在的我更从容了');
  });

  it('does not reserve a reflection section when there are no reflections', () => {
    const html = renderToStaticMarkup(<MemoryDetail imageUrl="/lake.jpg" memory={makeEcho().memory!} onClose={() => undefined} onDelete={() => undefined} onEdit={() => undefined} reflections={[]} />);
    expect(html).not.toContain('回声感言');
  });
});
