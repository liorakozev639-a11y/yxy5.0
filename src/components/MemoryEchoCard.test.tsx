import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MemoryEchoCard } from './MemoryEchoCard';
import { makeEcho } from '../test-utils/memory-echo';

describe('MemoryEchoCard', () => {
  it('shows the reason, memory details and primary actions', () => {
    const html = renderToStaticMarkup(<MemoryEchoCard echo={makeEcho()} index={0} onDismiss={() => undefined} onExclude={() => undefined} onNext={() => undefined} onOpen={() => undefined} onOpenAll={() => undefined} onReflect={() => undefined} onDisableTopic={() => undefined} total={3} />);
    expect(html).toContain('3年前的今天');
    expect(html).toContain('湖边的午后');
    expect(html).toContain('开心');
    expect(html).toContain('旅行');
    expect(html).toContain('写下感言');
    expect(html).toContain('换一条');
    expect(html).toContain('查看全部');
  });

  it('shows both memories for a past-versus-now echo', () => {
    const comparison = { ...makeEcho().memory!, id: 'memory-old', title: '刚开始的时候', imageUrl: '/old.jpg' };
    const html = renderToStaticMarkup(<MemoryEchoCard echo={makeEcho({ type: 'PAST_AND_NOW', comparisonMemoryAvailable: true, comparisonMemory: comparison })} index={0} onDismiss={() => undefined} onExclude={() => undefined} onNext={() => undefined} onOpen={() => undefined} onOpenAll={() => undefined} onReflect={() => undefined} onDisableTopic={() => undefined} total={1} />);
    expect(html).toContain('那时');
    expect(html).toContain('现在');
    expect(html).toContain('刚开始的时候');
  });

  it('handles a missing original memory without breaking the card', () => {
    const html = renderToStaticMarkup(<MemoryEchoCard echo={makeEcho({ memoryAvailable: false, memory: undefined })} index={0} onDismiss={() => undefined} onExclude={() => undefined} onNext={() => undefined} onOpen={() => undefined} onOpenAll={() => undefined} onReflect={() => undefined} onDisableTopic={() => undefined} total={1} />);
    expect(html).toContain('原记忆已不可用');
  });

  it('uses the recorded source topic for the disable action', () => {
    const echo = makeEcho({
      sourceTopic: { id: 'topic-right', name: '考研' },
      memory: { ...makeEcho().memory!, topics: [{ id: 'topic-wrong', name: '恋爱' }, { id: 'topic-right', name: '考研' }] },
    });
    const html = renderToStaticMarkup(<MemoryEchoCard echo={echo} index={0} onDismiss={() => undefined} onExclude={() => undefined} onNext={() => undefined} onOpen={() => undefined} onOpenAll={() => undefined} onReflect={() => undefined} onDisableTopic={() => undefined} total={1} />);
    expect(html).toContain('关闭“考研”主题回声');
    expect(html).not.toContain('关闭“恋爱”主题回声');
  });
});
