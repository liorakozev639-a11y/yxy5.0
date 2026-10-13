import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { VaultPaths } from '../common/config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parsePostgresDatabaseUrl, redactDatabaseUrl } from './database-url.js';
import { VAULT_PATHS } from './vault-export.service.js';

export const PG_DUMP_RUNNER = 'PG_DUMP_RUNNER';
export const DATABASE_URL_TOKEN = 'DATABASE_URL_TOKEN';
export const PG_DUMP_PATH = 'PG_DUMP_PATH';
export type PgDumpRunner = (file: string, args: string[], env: NodeJS.ProcessEnv) => Promise<void>;

@Injectable()
export class VaultBackupService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VAULT_PATHS) private readonly paths: VaultPaths,
    @Inject(PG_DUMP_RUNNER) private readonly runner: PgDumpRunner,
    @Inject(DATABASE_URL_TOKEN) private readonly databaseUrl: string,
    @Inject(PG_DUMP_PATH) private readonly pgDumpPath: string,
  ) {}

  async create(userId: string, now = new Date()) {
    const database = parsePostgresDatabaseUrl(this.databaseUrl);
    await mkdir(this.paths.backups, { recursive: true });
    const fileName = `photo-memory-db-${stamp(now)}.dump`;
    const finalPath = join(this.paths.backups, fileName);
    const temporaryPath = join(this.paths.backups, `.${randomUUID()}.part`);
    const record = await this.prisma.backupRecord.create({ data: { userId, backupType: 'POSTGRESQL', status: 'RUNNING', storagePath: finalPath } });
    const args = [
      '--format=custom', `--file=${temporaryPath}`, `--host=${database.host}`, `--port=${database.port}`,
      `--username=${database.username}`, `--dbname=${database.database}`, `--schema=${database.schema}`, '--no-password',
    ];
    try {
      await this.runner(this.pgDumpPath, args, { ...process.env, PGPASSWORD: database.password });
      const file = await stat(temporaryPath);
      if (!file.isFile() || file.size === 0) throw new Error('pg_dump 未生成有效文件');
      await rename(temporaryPath, finalPath);
      const checksum = createHash('sha256').update(await readFile(finalPath)).digest('hex');
      return this.prisma.backupRecord.update({
        where: { id: record.id },
        data: { status: 'COMPLETED', fileSize: file.size, checksum, completedAt: new Date(), errorMessage: null },
      });
    } catch (error) {
      await rm(temporaryPath, { force: true });
      const message = redactError(error, this.databaseUrl, database.password);
      await this.prisma.backupRecord.update({ where: { id: record.id }, data: { status: 'FAILED', errorMessage: message, completedAt: new Date() } });
      throw new ServiceUnavailableException(`数据库备份失败：${message}`);
    }
  }

  list(userId: string) {
    return this.prisma.backupRecord.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 });
  }

  async status(userId: string) {
    const latest = await this.prisma.backupRecord.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return { database: redactDatabaseUrl(this.databaseUrl), latestBackup: latest, storage: await this.storage() };
  }

  async storage() {
    await Promise.all([this.paths.uploads, this.paths.backups, this.paths.exports, this.paths.temp].map((path) => mkdir(path, { recursive: true })));
    return {
      root: { path: this.paths.root, bytes: await directorySize(this.paths.root) },
      uploads: { path: this.paths.uploads, bytes: await directorySize(this.paths.uploads) },
      backups: { path: this.paths.backups, bytes: await directorySize(this.paths.backups) },
      exports: { path: this.paths.exports, bytes: await directorySize(this.paths.exports) },
      temp: { path: this.paths.temp, bytes: await directorySize(this.paths.temp) },
    };
  }
}

export const runPgDump: PgDumpRunner = (file, args, env) => new Promise((resolve, reject) => {
  const child = spawn(file, args, { env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { if (stderr.length < 8_000) stderr += String(chunk); });
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `pg_dump exited with code ${code}`)));
});

async function directorySize(path: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) total += await directorySize(child);
    else if (entry.isFile()) total += (await stat(child)).size;
  }
  return total;
}

function redactError(error: unknown, databaseUrl: string, password: string): string {
  let message = error instanceof Error ? error.message : 'pg_dump 执行失败';
  for (const secret of [databaseUrl, password, encodeURIComponent(password)].filter(Boolean)) message = message.split(secret).join('<redacted>');
  return message.slice(0, 500);
}

function stamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
