import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EchoReflectionEditor } from './EchoReflectionEditor';
import { EchoSettingsPanel } from './EchoSettingsPanel';
import { EchoDisabledCard, groupEchoesByDate, MemoryEchoPage, nextEchoIndex } from './MemoryEchoPage';
import { makeEcho } from '../test-utils/memory-echo';

describe('MemoryEchoPage', () => {
  it('shows at most three today echoes and recent thirty-day history', () => {
    const today = [1, 2, 3, 4].map((displayOrder) => makeEcho({ id: `today-${displayOrder}`, displayOrder }));
    const history = [makeEcho({ id: 'today-duplicate', echoDate: '2026-10-13' }), makeEcho({ id: 'old-1', echoDate: '2026-10-01' })];
    const html = renderToStaticMarkup(<MemoryEchoPage history={history} onBack={() => undefined} onDismiss={() => undefined} onExclude={() => undefined} onOpen={() => undefined} onOpenSettings={() => undefined} onReflect={() => undefined} onDisableTopic={() => undefined} today={today} />);
    expect((html.match(/今日回声/g) ?? [])).toHaveLength(3);
    expect(html).not.toContain('today-4');
    expect(html).not.toContain('today-duplicate');
    expect(html).toContain('最近30天');
    expect(html).toContain('2026年10月1日');
  });

  it('groups history by echo date in descending order', () => {
    const groups = groupEchoesByDate([
      makeEcho({ id: 'older', echoDate: '2026-09-30' }),
      makeEcho({ id: 'newer', echoDate: '2026-10-01' }),
    ]);
    expect(groups.map(([date]) => date)).toEqual(['2026-10-01', '2026-09-30']);
  });

  it('rotates only through active daily echoes', () => {
    const echoes = [makeEcho({ id: 'first' }), makeEcho({ id: 'dismissed', status: 'DISMISSED' }), makeEcho({ id: 'third' })];
    expect(nextEchoIndex(0, echoes)).toBe(2);
    expect(nextEchoIndex(2, echoes)).toBe(0);
  });

  it('shows the gentle empty state', () => {
    const html = renderToStaticMarkup(<MemoryEchoPage history={[]} onBack={() => undefined} onDismiss={() => undefined} onExclude={() => undefined} onOpen={() => undefined} onOpenSettings={() => undefined} onReflect={() => undefined} onDisableTopic={() => undefined} today={[]} />);
    expect(html).toContain('过去的记忆还在慢慢积累');
  });

  it('does not render dead rotation or all-history actions on history-only cards', () => {
    const html = renderToStaticMarkup(<MemoryEchoPage history={[makeEcho({ id: 'old-1', echoDate: '2026-10-01' })]} onBack={() => undefined} onDismiss={() => undefined} onExclude={() => undefined} onOpen={() => undefined} onOpenSettings={() => undefined} onReflect={() => undefined} onDisableTopic={() => undefined} today={[]} />);
    expect(html).not.toContain('换一条');
    expect(html).not.toContain('查看全部');
  });
});

describe('echo controls', () => {
  it('renders a reflection editor with the two-thousand-character boundary', () => {
    const html = renderToStaticMarkup(<EchoReflectionEditor echo={makeEcho()} onCancel={() => undefined} onSave={async () => undefined} />);
    expect(html).toContain('回声感言');
    expect(html).toContain('maxLength="2000"');
  });

  it('renders the total switch and mood exclusions', () => {
    const html = renderToStaticMarkup(<EchoSettingsPanel availableMoods={['开心', '焦虑']} disabledTopics={[]} excludedMemories={[makeEcho().memory!]} onClose={() => undefined} onSave={async () => undefined} preference={{ userId: 'local-user', enabled: true, excludedMoods: ['焦虑'] }} onRestoreMemory={async () => undefined} onRestoreTopic={async () => undefined} />);
    expect(html).toContain('记忆回声总开关');
    expect(html).toContain('焦虑');
    expect(html).toContain('排除心情');
    expect(html).toContain('已排除的记忆');
    expect(html).toContain('湖边的午后');
    expect(html).toContain('恢复回声');
  });

  it('keeps history and settings reachable while the total switch is off', () => {
    const html = renderToStaticMarkup(<EchoDisabledCard onOpenHistory={() => undefined} onOpenSettings={() => undefined} />);
    expect(html).toContain('记忆回声已关闭');
    expect(html).toContain('查看历史');
    expect(html).toContain('重新开启');
  });
});
