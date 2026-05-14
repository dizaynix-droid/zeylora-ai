-- Backup and disaster recovery event metadata.
-- Stores only operational metadata and private storage keys. Backup files must
-- stay in private R2/S3 storage and must not contain secrets or auth tokens.

CREATE TABLE IF NOT EXISTS "BackupEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "fileSize" INTEGER,
  "storageLocation" TEXT,
  "restoreTested" BOOLEAN NOT NULL DEFAULT false,
  "errorMessage" TEXT,
  "metadataJson" JSONB,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BackupEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BackupEvent_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BackupEvent_type_status_startedAt_idx"
  ON "BackupEvent"("type", "status", "startedAt");

CREATE INDEX IF NOT EXISTS "BackupEvent_createdByUserId_startedAt_idx"
  ON "BackupEvent"("createdByUserId", "startedAt");
