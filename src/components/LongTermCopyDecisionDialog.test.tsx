import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { areCopyDecisionsComplete, LongTermCopyDecisionDialog, type CopyDecisionMap } from './LongTermCopyDecisionDialog';

const candidates = [
  { topic: { id: 'love', name: '恋爱' }, copy: undefined },
  { topic: { id: 'exam', name: '考研' }, copy: { id: 'copy-exam', name: '考研', topicId: 'exam', startDate: '2026-01-01', lifecycleStatus: 'PAUSED' as const, autoCollectEnabled: false } },
];

describe('LongTermCopyDecisionDialog', () => {
  it('renders every topic in one dialog with the correct action context', () => {
    const html = renderToStaticMarkup(<LongTermCopyDecisionDialog candidates={candidates} onCancel={() => undefined} onConfirm={async () => undefined} />);
    expect(html).toContain('恋爱');
    expect(html).toContain('考研');
    expect(html).toContain('创建长期副本');
    expect(html).toContain('开启自动收录');
    expect(html).toContain('以后不再询问此主题');
  });

  it('requires a decision for every listed topic', () => {
    expect(areCopyDecisionsComplete(candidates, { love: 'enable' })).toBe(false);
    const complete: CopyDecisionMap = { love: 'enable', exam: 'suppress' };
    expect(areCopyDecisionsComplete(candidates, complete)).toBe(true);
  });
});
