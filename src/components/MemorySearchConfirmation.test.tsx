import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MemorySearchConfirmation } from './MemorySearchConfirmation';

const parsed = {
  criteria: { mood: '开心', topicIds: ['topic-love'] },
  pendingKeywords: ['海边'],
  recognized: [{ type: 'time' as const, label: '上个月' }, { type: 'mood' as const, label: '开心' }, { type: 'topic' as const, label: '恋爱' }],
};

describe('MemorySearchConfirmation', () => {
  it('shows recognized chips and disables searching before explicit confirmation', () => {
    const html = renderToStaticMarkup(<MemorySearchConfirmation parsed={parsed} confirmed={false} onConfirmChange={() => undefined} onStart={() => undefined} />);
    expect(html).toContain('上个月');
    expect(html).toContain('开心');
    expect(html).toContain('恋爱');
    expect(html).toContain('海边');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>开始寻迹<\/button>/);
  });

  it('enables searching after the user confirms the parsed conditions', () => {
    const html = renderToStaticMarkup(<MemorySearchConfirmation parsed={parsed} confirmed onConfirmChange={() => undefined} onStart={() => undefined} />);
    expect(html).toMatch(/<button[^>]*>开始寻迹<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>开始寻迹<\/button>/);
  });
});
