CREATE INDEX IF NOT EXISTS "User_deletedAt_createdAt_idx" ON "User"("deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "CreditTransaction_createdAt_idx" ON "CreditTransaction"("createdAt");

CREATE INDEX IF NOT EXISTS "VerificationJob_deletedAt_createdAt_idx" ON "VerificationJob"("deletedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "VerificationJob_deletedAt_status_createdAt_idx" ON "VerificationJob"("deletedAt", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Payment_deletedAt_createdAt_idx" ON "Payment"("deletedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_deletedAt_status_createdAt_idx" ON "Payment"("deletedAt", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "AdminLog_createdAt_idx" ON "AdminLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminLog_action_createdAt_idx" ON "AdminLog"("action", "createdAt");

CREATE INDEX IF NOT EXISTS "WebhookLog_source_createdAt_idx" ON "WebhookLog"("source", "createdAt");

CREATE INDEX IF NOT EXISTS "EmailEvent_status_updatedAt_idx" ON "EmailEvent"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "EmailEvent_status_sentAt_idx" ON "EmailEvent"("status", "sentAt");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
