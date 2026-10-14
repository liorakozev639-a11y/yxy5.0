import { win32 } from 'node:path';

const VAULT_ROOT = 'D:\\yxy5.0\\data';

export type VaultPathKind = 'uploads' | 'backups' | 'exports' | 'temp';

export interface VaultPaths {
  root: string;
  uploads: string;
  backups: string;
  exports: string;
  temp: string;
}

export function getVaultPaths(): VaultPaths {
  return {
    root: VAULT_ROOT,
    uploads: win32.join(VAULT_ROOT, 'uploads'),
    backups: win32.join(VAULT_ROOT, 'backups'),
    exports: win32.join(VAULT_ROOT, 'exports'),
    temp: win32.join(VAULT_ROOT, 'temp'),
  };
}

export function resolveVaultChild(kind: VaultPathKind, ...parts: string[]): string {
  if (parts.some((part) => win32.isAbsolute(part))) {
    throw new Error('Absolute paths are not allowed in the data vault');
  }

  const base = getVaultPaths()[kind];
  const resolved = win32.resolve(base, ...parts);
  const relative = win32.relative(base, resolved);
  if (relative === '..' || relative.startsWith(`..${win32.sep}`) || win32.isAbsolute(relative)) {
    throw new Error('Resolved path is outside the data vault');
  }

  return resolved;
}

export const serverConfig = {
  port: Number(process.env.PORT ?? 3001),
  localUserId: process.env.LOCAL_USER_ID ?? 'local-user',
  databaseUrl: process.env.DATABASE_URL ?? '',
  uploadDir: getVaultPaths().uploads,
};

export interface SummaryAiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export function getSummaryAiConfig(): SummaryAiConfig {
  return {
    baseUrl: (process.env.SUMMARY_AI_BASE_URL ?? '').replace(/\/$/, ''),
    apiKey: process.env.SUMMARY_AI_API_KEY ?? '',
    model: process.env.SUMMARY_AI_MODEL ?? '',
    timeoutMs: positiveInteger(process.env.SUMMARY_AI_TIMEOUT_MS, 15000),
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
