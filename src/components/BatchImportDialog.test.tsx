import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BatchImportDialog } from './BatchImportDialog';

describe('BatchImportDialog', () => {
  it('asks whether multiple photos should share one topic', () => {
    const html = renderToStaticMarkup(<BatchImportDialog files={[new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })]} topics={[{ id: 'love', name: '恋爱' }]} onAddTopic={async () => ({ id: 'new', name: '新主题' })} onClose={() => undefined} onComplete={() => undefined} onResolvePolicy={async () => undefined} onSaveDraft={async (draft) => ({ ...draft, id: 'saved', createdAt: draft.eventAt, updatedAt: draft.eventAt })} />);
    expect(html).toContain('检测到你选择了 2 张照片');
    expect(html).toContain('是否为这批照片设置相同主题');
    expect(html).toContain('恋爱');
  });
});
