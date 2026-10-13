export type AppLockStatus = {
  configured: boolean;
  enabled: boolean;
  locked: boolean;
  autoLockMinutes: number;
  temporarilyLockedUntil?: string | null;
};

export type VaultLocation = { path: string; bytes: number };

export type BackupRecord = {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  completedAt?: string | null;
  fileSize?: number | null;
  checksum?: string | null;
  errorMessage?: string | null;
  storagePath?: string;
};

export type VaultStatus = {
  database: {
    provider: 'postgresql';
    host: string;
    port: number;
    database: string;
    schema: string;
    username: string;
  };
  latestBackup?: BackupRecord | null;
  storage: {
    root: VaultLocation;
    uploads: VaultLocation;
    backups: VaultLocation;
    exports: VaultLocation;
    temp: VaultLocation;
  };
};

export type ExportFormat = 'json' | 'zip' | 'pdf';
export type ExportResult = { fileName: string; mimeType: string; size: number; sha256: string; downloadUrl: string };

export type ImportPreview = {
  id: string;
  status: string;
  summary: Record<string, number>;
  warnings: string[];
  storageLocation: string;
};

export type RestoreResult = {
  id: string;
  status: string;
  result?: Record<string, number>;
  warnings?: string[];
};
