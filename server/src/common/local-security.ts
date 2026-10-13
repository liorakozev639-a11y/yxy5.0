export const LOCAL_BIND_HOST = '127.0.0.1';

const TRUSTED_LOCAL_ORIGINS = new Set([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
]);

export function isTrustedLocalOrigin(origin?: string): boolean {
  return origin === undefined || TRUSTED_LOCAL_ORIGINS.has(origin);
}
