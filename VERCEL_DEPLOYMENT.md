# Zeylora AI Vercel Deployment Runbook

Use this when moving Zeylora AI from localhost to a Vercel preview or production domain.

## 1. Required Production Environment Variables

Replace `zeylora.ai`, `PROJECT_REF`, `REGION`, and secret placeholders with the real production values.

### App

```env
NEXT_PUBLIC_SITE_URL="https://zeylora.ai"
NEXT_PUBLIC_SITE_NAME="Zeylora AI"
NEXT_PUBLIC_SUPPORT_EMAIL="support@zeylora.ai"
MAINTENANCE_MODE="false"
```

`NEXT_PUBLIC_SITE_URL` is used for canonical URLs, sitemap, robots, auth redirects, and Stripe checkout success/cancel URLs. Do not leave it as localhost in Vercel.

### Supabase + Prisma

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="YOUR_SUPABASE_PUBLISHABLE_KEY"
```

Use `DATABASE_URL` with the Supabase transaction pooler on `6543` for Vercel runtime. Keep `DIRECT_URL` present because Prisma schema references it; it is mainly for Prisma CLI/migration workflows. If `5432` is blocked from your local network, use the Supabase SQL Editor fallback already documented in `SUPABASE_SQL_EDITOR_FALLBACK.md`.

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

The bucket must remain private. Zeylora uses signed URLs instead of raw public R2 URLs.

### AI Providers

```env
REPLICATE_API_TOKEN="YOUR_REPLICATE_TOKEN"
PHOTOROOM_API_KEY="YOUR_PHOTOROOM_LIVE_KEY"
BACKGROUND_REMOVAL_PROVIDER="replicate"
AI_BACKGROUND_REMOVER_MODEL="851-labs/background-remover"
AI_BACKGROUND_REMOVER_FALLBACK_MODEL="lucataco/remove-bg"
AI_BACKGROUND_REMOVER_HIGH_QUALITY_MODEL="bria/remove-background"
AI_BACKGROUND_REMOVER_QUALITY_MODE="standard"
AI_JOB_TIMEOUT_SECONDS="90"
AI_JOB_MAX_RETRIES="1"
AI_JOB_POLL_INTERVAL_SECONDS="2"
AI_PHOTO_ENHANCER_MODEL="nightmareai/real-esrgan"
AI_PHOTO_ENHANCER_SCALE="2"
AI_PHOTO_ENHANCER_FACE_ENHANCE="false"
AI_PHOTO_ENHANCER_TIMEOUT_SECONDS="90"
AI_PHOTO_ENHANCER_MAX_RETRIES="1"
AI_HD_UPSCALE_MODEL="nightmareai/real-esrgan"
AI_HD_UPSCALE_TIMEOUT_SECONDS="90"
AI_HD_UPSCALE_MAX_RETRIES="1"
```

Fast and Standard Background Remover use Replicate. High Quality uses PhotoRoom when `PHOTOROOM_API_KEY` is configured.

### Stripe

```env
STRIPE_SECRET_KEY="sk_test_or_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Use test mode first. Switch to live keys only after checkout, webhook verification, credit delivery, and clean export behavior are verified.

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

## 2. Localhost Dependency Check

The app has localhost fallbacks only for local development:

- `src/config/app.ts` falls back to `http://localhost:3000` only if `NEXT_PUBLIC_SITE_URL` is missing.
- Stripe checkout falls back to `http://localhost:3000` only if `NEXT_PUBLIC_SITE_URL` is missing.
- Production must set `NEXT_PUBLIC_SITE_URL` in Vercel for canonical URLs, sitemap, auth redirect URLs, and Stripe checkout URLs to be correct.

## 3. Vercel Setup

1. Import the repository into Vercel.
2. Framework preset: `Next.js`.
3. Install command: `npm install`.
4. Build command: `npm run build`.
5. Output directory: leave empty/default.
6. Node.js version: Vercel default modern Node is OK for Next.js 15. If choosing manually, use Node 20+.
7. Add all environment variables above in Vercel Project Settings -> Environment Variables.
8. Deploy first to a Vercel preview URL.
9. After smoke testing, connect the production domain.
10. Update `NEXT_PUBLIC_SITE_URL` to the final production domain and redeploy.

## 4. Supabase Production URLs

Supabase Dashboard -> Authentication -> URL Configuration:

```text
Site URL:
https://zeylora.ai

Redirect URLs:
https://zeylora.ai/auth/callback
https://www.zeylora.ai/auth/callback
https://YOUR_PROJECT.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

Only include `www` if you will use `www`. Keep localhost while local development is still needed.

For Magic Link, confirm email templates use Supabase's confirmation link and allow redirecting back to `/auth/callback`.

## 5. Google OAuth URLs

Google Cloud Console -> OAuth Client:

```text
Authorized JavaScript origins:
https://zeylora.ai
https://www.zeylora.ai
https://YOUR_PROJECT.vercel.app

Authorized redirect URI:
https://PROJECT_REF.supabase.co/auth/v1/callback
```

Supabase Dashboard -> Authentication -> Providers -> Google:

```text
Client ID: production Google OAuth client ID
Client Secret: production Google OAuth client secret
Callback URL shown by Supabase:
https://PROJECT_REF.supabase.co/auth/v1/callback
```

The app's own final redirect after Supabase is:

```text
https://zeylora.ai/auth/callback
```

## 6. Stripe URLs

Stripe Dashboard -> Developers -> Webhooks:

```text
Endpoint URL:
https://zeylora.ai/api/v1/payments/stripe/webhook

Events:
checkout.session.completed
checkout.session.expired
```

Copy the endpoint signing secret into:

```env
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Checkout success and cancel URLs are generated from `NEXT_PUBLIC_SITE_URL`:

```text
Success:
https://zeylora.ai/dashboard#credits

Cancel:
https://zeylora.ai/pricing
```

## 7. Cloudflare R2 Checklist

- Bucket: private.
- Public access: disabled.
- API token/key: object read/write access for the production bucket.
- Endpoint: `https://YOUR_CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com`.
- CORS is only needed if the browser directly talks to R2. Zeylora currently uploads through app API routes and uses signed read/download URLs, so keep CORS tight.

Recommended CORS if needed:

```json
[
  {
    "AllowedOrigins": [
      "https://zeylora.ai",
      "https://www.zeylora.ai",
      "https://YOUR_PROJECT.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 8. Production Logging Safety

- Development auth/dashboard/provider timing logs are gated by `NODE_ENV === "development"`.
- Production errors should remain user-friendly.
- Do not log raw signed URLs, provider response bodies, uploaded image contents, Stripe secrets, webhook signatures, R2 keys, or Supabase keys.
- Vercel logs can still include route status and generic error messages.

## 9. Deployment Validation

Run locally before deploy:

```bash
npm run typecheck
npm run build
```

Run after deploy:

1. Open homepage on the Vercel URL.
2. Confirm canonical metadata and sitemap use the deployed URL.
3. Sign in with Magic Link.
4. Sign in with Google OAuth.
5. Upload JPG, PNG, and WebP.
6. Run all six tools:
   - Background Remover
   - Photo Enhancer
   - HD Upscale
   - Marketplace Crop
   - Product Shadow
   - AI Relight
7. Confirm result preview, dashboard history, rating, and download.
8. Confirm free exports are watermarked.
9. Confirm paid clean export path if test credits exist.
10. Test Stripe checkout in test mode.
11. Confirm webhook credits are delivered.
12. Confirm `/privacy`, `/terms`, `/refund-policy`, and `/contact` load.
