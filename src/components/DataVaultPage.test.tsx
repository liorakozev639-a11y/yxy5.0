import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataVaultPage } from './DataVaultPage';

describe('DataVaultPage', () => {
  it('shows export, import, backup, lock and transparent storage controls', () => {
    const html = renderToStaticMarkup(<DataVaultPage
      appLockRepository={{} as any}
      lockStatus={{ configured: true, enabled: true, locked: false, autoLockMinutes: 30 }}
      onBack={() => undefined}
      onLockStatusChange={() => undefined}
      repository={{} as any}
      initialStatus={{
        database: { provider: 'postgresql', host: 'localhost', port: 5433, database: 'photo_memory', schema: 'public', username: 'm***r' },
        latestBackup: { id: 'backup-1', status: 'COMPLETED', createdAt: '2026-10-13T04:00:00Z', fileSize: 38308 },
        storage: {
          root: { path: 'D:\\yxy5.0\\data', bytes: 50000 }, uploads: { path: 'D:\\yxy5.0\\data\\uploads', bytes: 10000 },
          backups: { path: 'D:\\yxy5.0\\data\\backups', bytes: 30000 }, exports: { path: 'D:\\yxy5.0\\data\\exports', bytes: 10000 }, temp: { path: 'D:\\yxy5.0\\data\\temp', bytes: 0 },
        },
      }}
    />);

    expect(html).toContain('数据保险箱');
    expect(html).toContain('导出 JSON');
    expect(html).toContain('导出 ZIP');
    expect(html).toContain('导出 PDF');
    expect(html).toContain('导入恢复');
    expect(html).toContain('数据库备份');
    expect(html).toContain('应用锁');
    expect(html).toContain('D:\\yxy5.0\\data\\uploads');
    expect(html).toContain('PostgreSQL');
  });
});
