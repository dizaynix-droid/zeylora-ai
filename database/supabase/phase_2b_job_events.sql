-- Phase 2B incremental migration: JobEvent table for AI job timeline logs.
-- Run this in Supabase SQL Editor if Prisma migrate cannot connect from your machine.

CREATE TABLE IF NOT EXISTS "JobEvent" (
    "id" TEXT NOT NULL,
    "aiJobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JobEvent_aiJobId_createdAt_idx" ON "JobEvent"("aiJobId", "createdAt");
CREATE INDEX IF NOT EXISTS "JobEvent_type_idx" ON "JobEvent"("type");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'JobEvent_aiJobId_fkey'
    ) THEN
        ALTER TABLE "JobEvent"
        ADD CONSTRAINT "JobEvent_aiJobId_fkey"
        FOREIGN KEY ("aiJobId") REFERENCES "AiJob"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
