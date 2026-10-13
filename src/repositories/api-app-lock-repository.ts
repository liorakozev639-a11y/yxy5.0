import { ApiClient } from '../api/client';
import type { AppLockStatus } from '../domain/data-vault';

export class ApiAppLockRepository {
  constructor(private readonly client: ApiClient) {}

  status(): Promise<AppLockStatus> {
    return this.client.request('/api/app-lock/status');
  }

  setup(password: string, autoLockMinutes: number) {
    return this.client.request<{ recoveryKey: string; autoLockMinutes: number }>('/api/app-lock/setup', {
      method: 'POST', body: JSON.stringify({ password, autoLockMinutes }),
    });
  }

  unlock(password: string) {
    return this.client.request<{ unlocked: true }>('/api/app-lock/unlock', { method: 'POST', body: JSON.stringify({ password }) });
  }

  verify(password: string) {
    return this.client.request<{ verifiedUntil: string }>('/api/app-lock/verify', { method: 'POST', body: JSON.stringify({ password }) });
  }

  lock() {
    return this.client.request<{ locked: true }>('/api/app-lock/lock', { method: 'POST' });
  }

  updateSettings(input: { enabled?: boolean; autoLockMinutes?: number }) {
    return this.client.request<Pick<AppLockStatus, 'configured' | 'enabled' | 'autoLockMinutes'>>('/api/app-lock/settings', {
      method: 'PATCH', body: JSON.stringify(input),
    });
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.client.request<{ changed: true }>('/api/app-lock/change-password', {
      method: 'POST', body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  recover(recoveryKey: string, newPassword: string) {
    return this.client.request<{ recoveryKey: string; recovered: true }>('/api/app-lock/recover', {
      method: 'POST', body: JSON.stringify({ recoveryKey, newPassword }),
    });
  }
}
