import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MemorySearchInput } from './MemorySearchInput';

describe('MemorySearchInput', () => {
  it('renders local-language guidance and at most twenty recent searches', () => {
    const history = Array.from({ length: 22 }, (_, index) => ({
      id: `search-${index}`,
      displayText: `最近搜索 ${index}`,
      criteria: {},
      createdAt: '2026-10-15T00:00:00.000Z',
      invalidMood: index === 0,
      invalidStatusValues: index === 0 ? ['已删除状态'] : [],
      invalidTopicIds: [],
    }));
    const html = renderToStaticMarkup(
      <MemorySearchInput
        value=""
        recentSearches={history}
        onChange={() => undefined}
        onParse={() => undefined}
        onUseHistory={() => undefined}
        onRemoveHistory={() => undefined}
        onClearHistory={() => undefined}
      />,
    );

    expect(html).toContain('描述你想找的经历');
    expect(html).toContain('上个月');
    expect(html).toContain('最近30天');
    expect(html).not.toContain('识别照片');
    expect(html).toContain('部分标签已失效，请确认后再寻迹');
    expect(html).toContain('清空最近搜索');
    expect(html).not.toContain('最近搜索 20');
  });
});
