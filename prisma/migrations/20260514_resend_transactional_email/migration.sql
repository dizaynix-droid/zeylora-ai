ALTER TYPE public."EmailEventType" ADD VALUE IF NOT EXISTS 'PASSWORD_RESET';
ALTER TYPE public."EmailEventType" ADD VALUE IF NOT EXISTS 'MFA_ENABLED';
ALTER TYPE public."EmailEventType" ADD VALUE IF NOT EXISTS 'TICKET_REPLY';
ALTER TYPE public."EmailEventType" ADD VALUE IF NOT EXISTS 'FAILED_PAYMENT';

ALTER TABLE public."EmailEvent"
  ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "EmailEvent_idempotencyKey_key" ON public."EmailEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "EmailEvent_recipientEmail_createdAt_idx" ON public."EmailEvent"("recipientEmail", "createdAt");
