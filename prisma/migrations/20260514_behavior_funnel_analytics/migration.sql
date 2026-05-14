-- Production behavior funnel analytics.
-- Stores privacy-safe product events only. No passwords, secrets, raw payment
-- card data, signed URLs, or full IP addresses should ever be written here.

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "sessionId" TEXT,
  "anonymousId" TEXT,
  "event" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'server',
  "page" TEXT,
  "referrer" TEXT,
  "country" TEXT,
  "device" TEXT,
  "browser" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AnalyticsEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_event_createdAt_idx"
  ON "AnalyticsEvent"("event", "createdAt");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_createdAt_idx"
  ON "AnalyticsEvent"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_sessionId_createdAt_idx"
  ON "AnalyticsEvent"("sessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_anonymousId_createdAt_idx"
  ON "AnalyticsEvent"("anonymousId", "createdAt");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_source_createdAt_idx"
  ON "AnalyticsEvent"("source", "createdAt");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_country_createdAt_idx"
  ON "AnalyticsEvent"("country", "createdAt");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_device_createdAt_idx"
  ON "AnalyticsEvent"("device", "createdAt");
