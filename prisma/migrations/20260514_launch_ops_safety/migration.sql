-- Launch operations and safety diagnostics.

ALTER TABLE "WebhookLog"
  ADD COLUMN IF NOT EXISTS "externalEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "WebhookLog_status_createdAt_idx"
  ON "WebhookLog"("status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookLog_source_externalEventId_key"
  ON "WebhookLog"("source", "externalEventId");
