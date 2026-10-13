import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LongTermCopyForm, resolveTopicSelection } from './LongTermCopyForm';

describe('LongTermCopyForm', () => {
  it('defaults auto collection to enabled and exposes the setting', () => {
    const html = renderToStaticMarkup(
      <LongTermCopyForm
        topics={[{ id: 'none', name: '无', isNone: true }, { id: 'love', name: '恋爱' }]}
        onCancel={() => undefined}
        onSubmit={async () => undefined}
      />,
    );

    expect(html).toContain('自动收集以后新增的同主题记忆');
    expect(html).toContain('checked=""');
  });

  it('selects the first available ordinary topic when topics arrive later', () => {
    expect(resolveTopicSelection('', [{ id: 'none', name: '无', isNone: true }, { id: 'exam', name: '考研' }])).toBe('exam');
    expect(resolveTopicSelection('love', [{ id: 'exam', name: '考研' }])).toBe('exam');
    expect(resolveTopicSelection('love', [{ id: 'love', name: '恋爱' }, { id: 'exam', name: '考研' }])).toBe('love');
  });
});
