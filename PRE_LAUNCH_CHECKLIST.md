# Zeylora AI Pre-Launch Checklist

Use this before pointing real traffic at the production domain. This checklist assumes Vercel + Supabase + Cloudflare R2 + Replicate + PhotoRoom + Stripe.

## 1. Production Compatibility

- Confirm `npm run typecheck` passes locally.
- Confirm `npm run build` passes locally.
- Deploy on Vercel with the default Next.js build command: `npm run build`.
- Keep all image-processing API routes on Node runtime. Current upload/job/payment routes use `runtime = "nodejs"` where needed.
- Sharp is used server-side only for local image transformations and watermarking.
- Do not move Sharp routes to Edge runtime.
- Confirm production logs do not include provider response bodies, signed URLs, raw upload contents, or user secrets.
- Keep development timing logs gated by `NODE_ENV === "development"`.

## 2. Vercel Project Setup

- Create/import the Git repository in Vercel.
- Framework preset: Next.js.
- Install command: `npm install`.
- Build command: `npm run build`.
- Output directory: leave default.
- Node version: use a modern Node version supported by Vercel and Next.js 15.
- Add production domain after the first successful deploy.
- Set all environment variables in Vercel before the production deploy that will receive traffic.

## 3. Environment Variables

### App

```env
NEXT_PUBLIC_SITE_URL="https://zeylora.ai"
NEXT_PUBLIC_SITE_NAME="Zeylora AI"
NEXT_PUBLIC_SUPPORT_EMAIL="support@zeylora.ai"
MAINTENANCE_MODE="false"
```

### Supabase

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-REGION.pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="YOUR_SUPABASE_PUBLISHABLE_KEY"
```

Use the transaction pooler on `6543` for Vercel runtime. `DIRECT_URL` is only for Prisma CLI/migrations where reachable. If direct/session pooler is blocked, use the Supabase SQL Editor fallback already documented in `SUPABASE_SQL_EDITOR_FALLBACK.md`.

### Cloudflare R2

```env
R2_ACCOUNT_ID="YOUR_CLOUDFLARE_ACCOUNT_ID"
R2_ACCESS_KEY_ID="YOUR_R2_ACCESS_KEY_ID"
R2_SECRET_ACCESS_KEY="YOUR_R2_SECRET_ACCESS_KEY"
R2_BUCKET_NAME="zeylora-production"
R2_ENDPOINT="https://YOUR_CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com"
UPLOAD_SIGNED_URL_TTL_SECONDS="900"
RESULT_SIGNED_URL_TTL_SECONDS="1800"
MAX_UPLOAD_SIZE_MB="12"
MAX_IMAGE_WIDTH="6000"
MAX_IMAGE_HEIGHT="6000"
```

### AI Providers

```env
REPLICATE_API_TOKEN="YOUR_REPLICATE_TOKEN"
PHOTOROOM_API_KEY="YOUR_PHOTOROOM_LIVE_KEY"
BACKGROUND_REMOVAL_PROVIDER="replicate"
AI_JOB_TIMEOUT_SECONDS="90"
AI_JOB_MAX_RETRIES="1"
AI_JOB_POLL_INTERVAL_SECONDS="2"
AI_PHOTO_ENHANCER_MODEL="nightmareai/real-esrgan"
AI_HD_UPSCALE_MODEL="nightmareai/real-esrgan"
```

High Quality Background Remover uses PhotoRoom when `PHOTOROOM_API_KEY` is present. Fast/Standard Background Remover, Photo Enhancer, and HD Upscale use Replicate.

### Stripe

```env
STRIPE_SECRET_KEY="sk_live_or_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Use Stripe test mode first. Only switch to live keys after webhook credit delivery has been verified.

### Analytics Placeholders

```env
NEXT_PUBLIC_POSTHOG_ENABLED="false"
NEXT_PUBLIC_POSTHOG_KEY=""
NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"
NEXT_PUBLIC_PLAUSIBLE_ENABLED="false"
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=""
NEXT_PUBLIC_GA4_ENABLED="false"
NEXT_PUBLIC_GA4_MEASUREMENT_ID=""
```

## 4. Supabase Production Setup

- Authentication -> URL Configuration:
  - Site URL: `https://zeylora.ai`
  - Redirect URL: `https://zeylora.ai/auth/callback`
  - Add `https://www.zeylora.ai/auth/callback` if using `www`.
- Authentication -> Providers -> Email:
  - Email provider enabled.
  - Signups enabled if public beta is open.
  - Confirm email behavior tested.
- Authentication -> Providers -> Google:
  - Add production Google client ID/secret.
  - Confirm Supabase callback URL is registered in Google Cloud.
- Database:
  - Confirm all Prisma/Supabase tables exist.
  - Confirm seed data includes six active tools.
  - Confirm `JobEvent`, `CreditTransaction`, `Payment`, and `WebhookLog` tables exist.

## 5. Google OAuth Setup

- Google Cloud Console -> OAuth Client:
  - Authorized JavaScript origins:
    - `https://zeylora.ai`
    - `https://www.zeylora.ai` if used.
  - Authorized redirect URI:
    - Supabase Google callback URL from Supabase provider settings.
- Test Google login in an incognito browser after deploy.

## 6. Cloudflare R2 Setup

- Bucket must be private.
- Do not expose raw R2 object URLs.
- R2 API key must have object read/write permission for the production bucket.
- Signed URLs must work for upload previews, result previews, and downloads.
- Add lifecycle policy for old temporary uploads/results before scale.
- If configuring CORS, allow only production origin plus local origin for development.

## 7. Stripe Setup

- Start in Stripe test mode.
- Create credit products/prices or rely on dynamic `price_data` for controlled testing.
- Add webhook endpoint:
  - `https://zeylora.ai/api/v1/payments/stripe/webhook`
- Subscribe at minimum:
  - `checkout.session.completed`
  - `checkout.session.expired`
- Copy webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
- Test one checkout and confirm credits are delivered.

## 8. Rate Limit Preparation

Current abuse protection is in-memory. It is acceptable for a small controlled launch on one Vercel instance, but it is not durable across serverless instances.

Before paid traffic or broad public launch, migrate rate limits to Redis/Upstash:

- Replace the in-memory map in `src/lib/abuse/rate-limit.ts`.
- Use keys like:
  - `rate:upload:user:{userId}`
  - `rate:job:user:{userId}`
  - `rate:upload:ip:{ip}`
  - `rate:job:ip:{ip}`
- Preserve the same response shape: `code`, `retryAfterSeconds`, and `Retry-After` header.
- Keep per-user cooldown and per-window limits.

## 9. Final Pre-Launch Gates

- Legal/contact pages contain real support/company details.
- `robots.txt` and `sitemap.xml` are correct.
- Dashboard/auth pages are noindexed.
- Free exports are visibly watermarked.
- Paid clean exports are watermark-free when credits exist.
- Stripe test checkout delivers credits.
- Failed charged jobs refund credits.
- Provider errors remain user-friendly.
- Vercel logs do not expose secrets or signed URLs.
- Manual smoke test in `POST_DEPLOY_SMOKE_TEST.md` is completed.
