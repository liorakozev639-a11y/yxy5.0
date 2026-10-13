import { BadRequestException } from '@nestjs/common';

export type ParsedPostgresUrl = {
  provider: 'postgresql';
  host: string;
  port: number;
  database: string;
  schema: string;
  username: string;
  password: string;
};

export function parsePostgresDatabaseUrl(value: string): ParsedPostgresUrl {
  let url: URL;
  try { url = new URL(value); } catch { throw new BadRequestException('DATABASE_URL 无法解析'); }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') throw new BadRequestException('DATABASE_URL 必须是 PostgreSQL');
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!url.hostname || !database) throw new BadRequestException('DATABASE_URL 缺少主机或数据库名');
  return {
    provider: 'postgresql',
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port || 5432),
    database,
    schema: url.searchParams.get('schema') || 'public',
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

export function redactDatabaseUrl(value: string) {
  const parsed = parsePostgresDatabaseUrl(value);
  return {
    provider: parsed.provider,
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    schema: parsed.schema,
    username: maskUsername(parsed.username),
  };
}

function maskUsername(username: string): string {
  if (username.length < 2) return '***';
  return `${username[0]}***${username.at(-1)}`;
}
