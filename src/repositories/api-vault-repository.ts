import { ApiClient } from '../api/client';
import type { BackupRecord, ExportFormat, ExportResult, ImportPreview, RestoreResult, VaultStatus } from '../domain/data-vault';

export class ApiVaultRepository {
  constructor(private readonly client: ApiClient) {}

  status(): Promise<VaultStatus> { return this.client.request('/api/vault/status'); }
  backups(): Promise<BackupRecord[]> { return this.client.request('/api/vault/backups'); }
  export(format: ExportFormat): Promise<ExportResult> {
    return this.client.request(`/api/vault/exports/${format}`, { method: 'POST' });
  }
  backup(): Promise<BackupRecord> { return this.client.request('/api/vault/backups', { method: 'POST' }); }
  inspect(file: File): Promise<ImportPreview> {
    const body = new FormData();
    body.set('file', file);
    return this.client.request('/api/vault/imports/inspect', { method: 'POST', body });
  }
  restore(id: string): Promise<RestoreResult> {
    return this.client.request(`/api/vault/imports/${encodeURIComponent(id)}/restore`, { method: 'POST' });
  }
}
