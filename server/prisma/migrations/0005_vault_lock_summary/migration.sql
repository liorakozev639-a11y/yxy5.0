CREATE TYPE "VaultJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "AppLockSetting" (
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "passwordHash" TEXT NOT NULL,
  "recoveryKeyHash" TEXT NOT NULL,
  "autoLockMinutes" INTEGER NOT NULL DEFAULT 30,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppLockSetting_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "AppSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "verifiedUntil" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackupRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "backupType" TEXT NOT NULL DEFAULT 'POSTGRESQL',
  "status" "VaultJobStatus" NOT NULL DEFAULT 'PENDING',
  "storagePath" TEXT,
  "fileSize" INTEGER,
  "checksum" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "status" "VaultJobStatus" NOT NULL DEFAULT 'PENDING',
  "storagePath" TEXT,
  "summary" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ImportRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppSession_tokenHash_key" ON "AppSession"("tokenHash");
CREATE INDEX "AppSession_userId_expiresAt_idx" ON "AppSession"("userId", "expiresAt");
CREATE INDEX "BackupRecord_userId_createdAt_idx" ON "BackupRecord"("userId", "createdAt" DESC);
CREATE INDEX "ImportRecord_userId_createdAt_idx" ON "ImportRecord"("userId", "createdAt" DESC);
