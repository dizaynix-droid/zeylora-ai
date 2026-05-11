# Zeylora AI Production Readiness

Use this checklist before connecting paid checkout or sending real traffic to production.

## Environment Checklist

- `NEXT_PUBLIC_SITE_URL`: production domain, for example `https://zeylora.ai`.
- `NEXT_PUBLIC_SITE_NAME`: `Zeylora AI`.
- `NEXT_PUBLIC_SUPPORT_EMAIL`: real support inbox shown on legal/contact pages.
- `DATABASE_URL`: Supabase transaction pooler URL for app runtime.
- `DIRECT_URL`: Supabase session pooler or direct database URL for Prisma CLI if your network supports it.
- `NEXT_PUBLIC_SUPABASE_URL`: production Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: production Supabase publishable key.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`: production Cloudflare R2 credentials.
- `UPLOAD_SIGNED_URL_TTL_SECONDS`, `RESULT_SIGNED_URL_TTL_SECONDS`: keep short enough for private media access.
- `REPLICATE_API_TOKEN`: live Replicate token for Fast/Standard flows and Photo Enhancer.
- `PHOTOROOM_API_KEY`: live PhotoRoom key for High Quality Background Remover.
- `BACKGROUND_REMOVAL_PROVIDER`: keep `replicate` unless intentionally switching globally.
- Analytics IDs are optional until marketing launch: `NEXT_PUBLIC_POSTHOG_ENABLED`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_PLAUSIBLE_ENABLED`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_GA4_ENABLED`, `NEXT_PUBLIC_GA4_MEASUREMENT_ID`.

## Supabase Auth Redirect Checklist

In Supabase Dashboard -> Authentication -> URL Configuration:

- Site URL: production domain, for example `https://zeylora.ai`.
- Redirect URLs:
  - `https://zeylora.ai/auth/callback`
  - `https://www.zeylora.ai/auth/callback` if using `www`.
  - local dev callback can remain: `http://localhost:3000/auth/callback`.
- Confirm email templates point users back to `/auth/callback`.
- Keep email signups enabled only if beta signups are still desired.

## Google OAuth Production Checklist

In Google Cloud Console:

- Authorized JavaScript origins:
  - `https://zeylora.ai`
  - `https://www.zeylora.ai` if used.
- Authorized redirect URI:
  - Supabase callback URL from Supabase Auth -> Providers -> Google.
- Supabase Google provider:
  - production Google client ID.
  - production Google client secret.
- Test a new Google login in an incognito browser before paid traffic.

## PhotoRoom Live Key Checklist

- Confirm the key is a production/live PhotoRoom API key.
- Confirm sandbox watermark behavior is not active.
- Test High Quality Background Remover with:
  - product photo.
  - portrait/full-body edge case.
  - landscape object photo.
- Verify output is saved to R2 and then Zeylora free watermark is applied.
- Monitor provider cost and failures after launch.

## Replicate Checklist

- Confirm `REPLICATE_API_TOKEN` belongs to the production billing account.
- Confirm the configured models are available:
  - `851-labs/background-remover`
  - `lucataco/remove-bg`
  - `nightmareai/real-esrgan`
- Check timeout behavior with a large input image.
- Keep provider error details hidden from users in production.

## Cloudflare R2 Checklist

- Use a private bucket for uploads and generated results.
- Do not expose raw object URLs publicly.
- Use signed URLs for previews/downloads.
- CORS should allow the production domain for browser upload/download flows if needed.
- Recommended CORS origins:
  - `https://zeylora.ai`
  - `https://www.zeylora.ai` if used.
  - local dev origin only for development.
- Confirm lifecycle/retention policy for temporary uploads and old generated results.

## Deployment Checklist

- Run `npm run build`.
- Run `npm run typecheck`.
- Set all production environment variables in the hosting provider.
- Confirm `/privacy`, `/terms`, `/refund-policy`, and `/contact` load.
- Confirm `/dashboard` and `/auth/*` are noindexed.
- Confirm `robots.txt` disallows `/admin`, `/dashboard`, and `/api`.
- Confirm `sitemap.xml` lists public marketing/legal/tool pages only.
- Confirm missing pages show the friendly 404 page.
- Confirm generic production errors do not expose stack traces or provider internals.

## Post-Deploy Smoke Test

1. Open homepage and verify premium layout loads.
2. Sign in with Magic Link.
3. Sign out, then sign in with Google OAuth.
4. Upload a JPG, PNG, and WebP under the allowed size/dimension limits.
5. Run Background Remover:
   - Fast
   - Standard
   - High Quality
6. Run Photo Enhancer.
7. Verify result preview appears on homepage.
8. Download the result and confirm free export watermark:
   - diagonal protected pattern.
   - premium badge.
   - correct portrait/landscape placement.
9. Open dashboard and confirm jobs load progressively.
10. Confirm signed download links work and expire according to the configured TTL.
11. Open legal pages:
   - `/privacy`
   - `/terms`
   - `/refund-policy`
   - `/contact`
12. Check production logs for provider errors, upload validation errors, and auth callback issues.

## Before Payments

- Replace support email and company placeholders.
- Finalize paid credit/refund terms.
- Add checkout provider and webhook verification.
- Add paid export branch:
  - free export: protected watermark.
  - paid export: watermark-free full-quality export.
- Add admin monitoring for payments, provider costs, failed jobs, and refund review.
