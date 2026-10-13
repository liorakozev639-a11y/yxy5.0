import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getVaultPaths, resolveVaultChild } from '../src/common/config.js';

describe('data vault Prisma schema', () => {
  const schema = readFileSync(fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)), 'utf8');

  it('persists app-lock settings without storing a plaintext password', () => {
    expect(schema).toContain('model AppLockSetting');
    expect(schema).toMatch(/passwordHash\s+String/);
    expect(schema).toMatch(/recoveryKeyHash\s+String/);
    expect(schema).toMatch(/autoLockMinutes\s+Int/);
    expect(schema).not.toMatch(/\bpassword\s+String\b/);
  });

  it('persists unique server-side session token hashes', () => {
    expect(schema).toContain('model AppSession');
    expect(schema).toMatch(/tokenHash\s+String\s+@unique/);
    expect(schema).toContain('@unique');
    expect(schema).toMatch(/verifiedUntil\s+DateTime\?/);
    expect(schema).toMatch(/expiresAt\s+DateTime/);
  });

  it('tracks backup and import lifecycle status', () => {
    expect(schema).toContain('model BackupRecord');
    expect(schema).toContain('model ImportRecord');
    expect(schema).toMatch(/status\s+VaultJobStatus/);
    expect(schema).toMatch(/storagePath\s+String\?/);
    expect(schema).toMatch(/errorMessage\s+String\?/);
  });
});

describe('data vault paths', () => {
  it('keeps all runtime data in the fixed D-drive project data directory', () => {
    const paths = getVaultPaths();

    expect(paths.root).toBe('D:\\yxy5.0\\data');
    expect(paths.uploads).toBe('D:\\yxy5.0\\data\\uploads');
    expect(paths.backups).toBe('D:\\yxy5.0\\data\\backups');
    expect(paths.exports).toBe('D:\\yxy5.0\\data\\exports');
    expect(paths.temp).toBe('D:\\yxy5.0\\data\\temp');
  });

  it('resolves server-controlled child paths and rejects traversal or absolute paths', () => {
    expect(resolveVaultChild('exports', 'local-user', 'memory.zip')).toBe(
      'D:\\yxy5.0\\data\\exports\\local-user\\memory.zip',
    );
    expect(() => resolveVaultChild('exports', '..', 'secrets.txt')).toThrow(/outside/i);
    expect(() => resolveVaultChild('exports', 'C:\\Windows\\win.ini')).toThrow(/absolute/i);
  });
});
