import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LongTermCopiesView } from './LongTermCopiesView';

describe('LongTermCopiesView', () => {
  it('shows the fixed empty state when there are no copies', () => {
    const html = renderToStaticMarkup(<LongTermCopiesView copies={[]} topics={[]} onCreate={async () => undefined} onSelect={() => undefined} onToggleAutoCollect={async () => undefined} />);
    expect(html).toContain('暂无长期副本');
  });

  it('shows the automatic collection switch for an existing copy', () => {
    const html = renderToStaticMarkup(<LongTermCopiesView copies={[{ id: 'copy-1', name: '考研', topicId: 'topic-1', startDate: '2026-10-01', lifecycleStatus: 'ACTIVE', autoCollectEnabled: true }]} topics={[]} onCreate={async () => undefined} onSelect={() => undefined} onToggleAutoCollect={async () => undefined} />);
    expect(html).toContain('自动收集同主题新记忆');
    expect(html).toContain('checked=""');
  });
});
