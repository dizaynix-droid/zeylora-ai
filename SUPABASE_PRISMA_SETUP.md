# Zeylora AI Supabase + Prisma Setup

This project uses Prisma `5.22.x`, so Supabase compatibility is configured in `prisma/schema.prisma` with both:

```prisma
url       = env("DATABASE_URL")
directUrl = env("DIRECT_URL")
```

## Why Two URLs

Use two separate URLs:

- `DATABASE_URL`: runtime app traffic through Supabase/Supavisor transaction pooler.
- `DIRECT_URL`: Prisma CLI and migrations through session pooler or direct database connection.

This prevents Prisma Client runtime traffic and Prisma Migrate from fighting the same connection mode.

## Recommended `.env.local`

Use a custom Supabase database user named `prisma` if possible.

```env
DATABASE_URL="postgresql://prisma.PROJECT_REF:PRISMA_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://prisma.PROJECT_REF:PRISMA_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

If your local environment supports Supabase direct IPv6, or you have the Supabase IPv4 add-on, this is also valid for `DIRECT_URL`:

```env
DIRECT_URL="postgresql://prisma:PRISMA_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
```

## URL Parts

Replace:

- `PROJECT_REF`: Supabase project ref.
- `REGION`: Supabase pooler region, for example `us-east-1`.
- `PRISMA_PASSWORD`: password for the custom `prisma` DB user.

## Important Port Rules

```txt
Transaction pooler: 6543 -> DATABASE_URL
Session pooler:     5432 -> DIRECT_URL
Direct database:    5432 -> DIRECT_URL only if network supports it
```

Do not run migrations through transaction pooler.

## Migration Command

For local/development migration creation:

```bash
npm run prisma:migrate -- --name phase_2a_media_uploads
```

This resolves to:

```bash
prisma migrate dev --name phase_2a_media_uploads
```

Because `directUrl = env("DIRECT_URL")` is set, Prisma Migrate should use `DIRECT_URL` for migration work.

For production deployment of existing committed migrations:

```bash
npx prisma migrate deploy
```

## Custom Prisma User SQL

Run in Supabase SQL Editor if you have not created the user yet:

```sql
create user "prisma" with password 'CHANGE_ME' bypassrls createdb;
grant "prisma" to "postgres";

grant usage on schema public to prisma;
grant create on schema public to prisma;
grant all on all tables in schema public to prisma;
grant all on all routines in schema public to prisma;
grant all on all sequences in schema public to prisma;

alter default privileges for role postgres in schema public grant all on tables to prisma;
alter default privileges for role postgres in schema public grant all on routines to prisma;
alter default privileges for role postgres in schema public grant all on sequences to prisma;
```

## If Migrate Still Fails

Check these first:

1. Password is URL-encoded.
2. `DATABASE_URL` uses port `6543` and `?pgbouncer=true`.
3. `DIRECT_URL` uses port `5432`.
4. You are not using the transaction pooler for `DIRECT_URL`.
5. The `prisma` user has `createdb` and schema privileges.
6. Your network can reach the selected host.
7. If direct host `db.PROJECT_REF.supabase.co` fails locally, use session pooler for `DIRECT_URL`.
