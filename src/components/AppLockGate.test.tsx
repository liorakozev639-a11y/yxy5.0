import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppLockGate } from './AppLockGate';

const repository = {} as any;

describe('AppLockGate', () => {
  it('offers optional first-time setup and explains the one-time recovery key', () => {
    const html = renderToStaticMarkup(<AppLockGate onSkip={() => undefined} onStatusChange={() => undefined} repository={repository} status={{ configured: false, enabled: false, locked: false, autoLockMinutes: 30 }}><div>应用内容</div></AppLockGate>);
    expect(html).toContain('设置应用锁');
    expect(html).toContain('恢复密钥只显示一次');
    expect(html).toContain('暂不设置');
    expect(html).not.toContain('应用内容');
  });

  it('shows password and recovery entry while locked', () => {
    const html = renderToStaticMarkup(<AppLockGate onSkip={() => undefined} onStatusChange={() => undefined} repository={repository} status={{ configured: true, enabled: true, locked: true, autoLockMinutes: 30 }}><div>应用内容</div></AppLockGate>);
    expect(html).toContain('欢迎回来');
    expect(html).toContain('应用锁密码');
    expect(html).toContain('使用恢复密钥');
    expect(html).not.toContain('应用内容');
  });

  it('keeps the app mounted when unlocked', () => {
    const html = renderToStaticMarkup(<AppLockGate onSkip={() => undefined} onStatusChange={() => undefined} repository={repository} status={{ configured: true, enabled: true, locked: false, autoLockMinutes: 30 }}><div>应用内容</div></AppLockGate>);
    expect(html).toContain('应用内容');
  });
});
