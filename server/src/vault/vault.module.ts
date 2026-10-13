import { Module } from '@nestjs/common';
import { AppLockModule } from '../app-lock/app-lock.module.js';
import { getVaultPaths } from '../common/config.js';
import { VaultController } from './vault.controller.js';
import { VAULT_PATHS, VaultExportService } from './vault-export.service.js';
import { VaultImportService } from './vault-import.service.js';
import { DATABASE_URL_TOKEN, PG_DUMP_PATH, PG_DUMP_RUNNER, runPgDump, VaultBackupService } from './vault-backup.service.js';

@Module({
  imports: [AppLockModule],
  controllers: [VaultController],
  providers: [
    VaultExportService,
    VaultImportService,
    VaultBackupService,
    { provide: VAULT_PATHS, useValue: getVaultPaths() },
    { provide: PG_DUMP_RUNNER, useValue: runPgDump },
    { provide: DATABASE_URL_TOKEN, useFactory: () => process.env.DATABASE_URL ?? '' },
    { provide: PG_DUMP_PATH, useFactory: () => process.env.PG_DUMP_PATH ?? 'D:\\pgsql18\\pgsql\\pgAdmin 4\\runtime\\pg_dump.exe' },
  ],
  exports: [VaultExportService, VaultImportService, VaultBackupService, VAULT_PATHS],
})
export class VaultModule {}
