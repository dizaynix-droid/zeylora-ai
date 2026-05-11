-- Prisma migration baseline marker only.
-- Use this only if you already ran the schema SQL manually in Supabase SQL Editor.
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations" (
    "id",
    "checksum",
    "finished_at",
    "migration_name",
    "logs",
    "rolled_back_at",
    "started_at",
    "applied_steps_count"
)
SELECT
    '9d8cc91d-7f6b-45e5-81a9-998b77aea5b3',
    '4e52c0c8443feee2825581b629845de80d853d446c1b1073b8cdd2b16aca2283',
    now(),
    '20260510_phase_2a_supabase_baseline',
    NULL,
    NULL,
    now(),
    1
WHERE NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE "migration_name" = '20260510_phase_2a_supabase_baseline'
);
