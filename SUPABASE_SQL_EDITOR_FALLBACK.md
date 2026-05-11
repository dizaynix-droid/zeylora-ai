# Supabase SQL Editor Fallback

Use this only when Prisma Migrate cannot reach Supabase through direct DB, session pooler, or transaction pooler from your Mac/network.

This fallback creates the database schema manually in Supabase SQL Editor and records the Prisma migration as applied.

## Files

Schema only:

```txt
database/supabase/phase_2a_schema_only.sql
```

Full SQL Editor fallback, schema plus Prisma baseline marker:

```txt
database/supabase/phase_2a_sql_editor_full_with_prisma_baseline.sql
```

Baseline marker only, if you already ran the schema SQL:

```txt
database/supabase/phase_2a_prisma_baseline_only.sql
```

Local Prisma migration file:

```txt
prisma/migrations/20260510_phase_2a_supabase_baseline/migration.sql
```

## Important Safety Notes

- Run the full schema SQL only on an empty/new Supabase database schema.
- Do not repeatedly run the full schema SQL. PostgreSQL enum/table creation will fail if objects already exist.
- If part of the SQL already ran, inspect Supabase first before retrying.
- Do not use this for future incremental migrations unless we generate a new diff for that exact change.

## 1. Run SQL In Supabase SQL Editor

1. Open Supabase Dashboard.
2. Select the Zeylora AI project.
3. Go to SQL Editor.
4. Open this local file:

```txt
database/supabase/phase_2a_sql_editor_full_with_prisma_baseline.sql
```

5. Paste the full contents into SQL Editor.
6. Run it once.

This creates:

- all Prisma enums
- all Prisma tables
- indexes
- foreign keys
- `_prisma_migrations` baseline marker

## 2. Verify Tables Were Created

In Supabase SQL Editor, run:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

You should see tables including:

```txt
User
AiTool
AiJob
MediaAsset
CreditTransaction
CreditPackage
Payment
ProviderSetting
BlogPost
Page
FeatureFlag
_prisma_migrations
```

Verify Prisma baseline marker:

```sql
select migration_name, finished_at, applied_steps_count
from "_prisma_migrations"
order by started_at desc;
```

Expected migration:

```txt
20260510_phase_2a_supabase_baseline
```

Verify media upload columns:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'MediaAsset'
order by ordinal_position;
```

You should see:

```txt
originalFilename
checksum
processingStatus
metadataJson
```

## 3. Mark/Baseline Prisma Migration Locally

The local migration folder already exists:

```txt
prisma/migrations/20260510_phase_2a_supabase_baseline/migration.sql
```

Because the SQL Editor script inserts `_prisma_migrations`, you usually do not need to run:

```bash
npx prisma migrate resolve --applied 20260510_phase_2a_supabase_baseline
```

If the schema SQL was run without the baseline marker, paste and run:

```txt
database/supabase/phase_2a_prisma_baseline_only.sql
```

That manually records the migration as applied.

## 4. Generate Prisma Client

Run locally:

```bash
npm run prisma:generate
```

## 5. Seed Safely

After the schema exists and `.env.local` has a runtime `DATABASE_URL` that can connect through Supabase pooler, run:

```bash
npm run db:seed
```

The seed should print:

```txt
Dev upload test user id: <USER_ID>
```

Use that id for Phase 2A upload tests.

## Recommended `.env.local` After SQL Editor Setup

If migration paths do not work from your Mac, keep `DIRECT_URL` as a placeholder or the best available session/direct URL, but use the transaction pooler for runtime:

```env
DATABASE_URL="postgresql://prisma.PROJECT_REF:PRISMA_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://prisma.PROJECT_REF:PRISMA_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

For commands that do not need migration engine behavior:

```bash
npm run prisma:generate
npm run db:seed
```

For schema changes later, generate a new SQL diff and apply it through SQL Editor if Prisma Migrate still cannot connect.

## If Seed Cannot Connect Either

If `npm run db:seed` cannot connect through the transaction pooler, the issue is runtime connectivity, not migration-only connectivity.

Check:

- `DATABASE_URL` host.
- port `6543`.
- username format: `prisma.PROJECT_REF`.
- password is URL encoded.
- Supabase project is active.
- local network/VPN/firewall permits outbound PostgreSQL pooler connection.
