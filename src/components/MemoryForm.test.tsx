import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MemoryForm } from './MemoryForm';

describe('MemoryForm', () => {
  it('describes PostgreSQL-backed local storage instead of browser-only storage', () => {
    const html = renderToStaticMarkup(
      <MemoryForm
        customMoods={[]}
        customStatuses={[]}
        topics={[]}
        onAddMood={() => undefined}
        onAddStatus={() => undefined}
        onAddTopic={async (name) => ({ id: name, name })}
        onSave={async () => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(html).toContain('照片会保存到你的本地数据库');
    expect(html).not.toContain('照片会保存在当前浏览器中');
  });
});
