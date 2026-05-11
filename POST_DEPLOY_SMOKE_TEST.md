# Zeylora AI Post-Deploy Smoke Test

Run this on the production URL after every launch deploy. Use an incognito browser and a real test account.

## 1. Basic Site Checks

1. Open `https://your-domain.com`.
2. Confirm premium homepage loads without raw/unstyled HTML.
3. Confirm live tools count is `6`.
4. Confirm upload selector shows:
   - Background Remover
   - Photo Enhancer
   - HD Upscale
   - Marketplace Crop
   - Product Shadow
   - AI Relight
5. Confirm showcase section has 6 distinct cards.
6. Open `/pricing`, `/privacy`, `/terms`, `/refund-policy`, and `/contact`.
7. Confirm support email/company placeholders are replaced before public traffic.

## 2. Auth Checks

1. Open `/dashboard` while signed out.
2. Confirm redirect to `/auth/sign-in?next=/dashboard`.
3. Sign in with Magic Link.
4. Confirm callback lands on dashboard.
5. Sign out.
6. Sign in with Google OAuth.
7. Confirm dashboard shows the correct email.

## 3. Upload Checks

Use one JPG, one PNG, and one WebP under production limits.

1. Upload each format from the homepage.
2. Confirm local preview appears immediately.
3. Confirm upload completes without exposing a raw R2 URL.
4. Confirm invalid files are rejected with friendly copy.

## 4. Six-Tool Smoke Test

For each tool, verify:

- upload
- preset/quality selection
- job processing
- result workspace
- before/after slider
- download
- watermark/free export behavior
- dashboard history
- rating

### Background Remover

1. Select Background Remover.
2. Test `Fast`, `Standard`, and `High Quality`.
3. Confirm High Quality uses PhotoRoom when `PHOTOROOM_API_KEY` is configured.
4. Confirm fallback behavior is friendly if provider fails.
5. Download and confirm watermark for free/no-credit state.

### Photo Enhancer

1. Select Photo Enhancer.
2. Upload a dull or compressed product image.
3. Confirm enhanced result appears.
4. Confirm download works.
5. Confirm job appears in dashboard.

### HD Upscale

1. Select HD Upscale.
2. Upload a blurry/low-resolution image.
3. Test all presets:
   - 2x HD
   - 4x Ultra
   - Sharp Catalog
   - Social Cleanup
4. Confirm result looks sharper and download works.
5. Confirm dashboard history and rating work.

### Marketplace Crop

1. Select Marketplace Crop.
2. Generate `1:1`.
3. Change to `4:5`.
4. Confirm it does not auto-run.
5. Click Apply and confirm a new result is generated.
6. Repeat one vertical format such as `9:16`.
7. Confirm download filename reflects format.

### Product Shadow

1. Select Product Shadow.
2. Upload a transparent or clean product image.
3. Test:
   - Soft Studio
   - Floating Shadow
   - Luxury Catalog
   - Soft Floor
4. Confirm visual difference is obvious enough.
5. Confirm download and dashboard history.

### AI Relight

1. Select AI Relight.
2. Upload a dull product image.
3. Test:
   - Soft Studio Light
   - Luxury Glow
   - Bright Catalog
   - Dramatic Product Light
4. Confirm failed preset behavior is friendly and does not trap the UI.
5. Confirm download and dashboard history.

## 5. Credits and Export Modes

### Free/No-Credit Path

1. Use a user with `creditBalance = 0`.
2. Run any tool.
3. Confirm job succeeds.
4. Confirm export metadata is `free_watermarked`.
5. Confirm downloaded image includes protected Zeylora watermark.
6. Confirm no `USE` credit transaction is created.

### Paid Clean Path

1. Add credits to a test user through seed/manual DB or Stripe test webhook.
2. Run Background Remover.
3. Confirm credit transaction type `USE`.
4. Confirm balance decreases by tool cost.
5. Confirm export metadata is `paid_clean`.
6. Confirm downloaded image has no watermark.
7. Force or simulate a provider failure with a charged job in test mode.
8. Confirm refund transaction type `REFUND`.

## 6. Stripe Foundation

1. With Stripe env missing, call checkout endpoint and confirm friendly `stripe_not_configured` response.
2. Add Stripe test keys in Vercel.
3. Start checkout with a test user.
4. Complete Stripe test checkout.
5. Confirm webhook receives `checkout.session.completed`.
6. Confirm `Payment` becomes `PAID`.
7. Confirm purchased credits are added.
8. Confirm `CreditTransaction` type `PURCHASE`.

## 7. Abuse Protection

1. Rapidly upload more than the configured upload limit.
2. Confirm `429` with `Retry-After`.
3. Rapidly start several jobs.
4. Confirm cooldown/rate-limit response is friendly.
5. Confirm normal usage still works after waiting.

Note: production abuse protection is currently in-memory. Move to Redis/Upstash before paid traffic or broad public launch.

## 8. Mobile Smoke Test

Run on a real phone or browser device emulation:

1. Homepage hero and upload area.
2. Tool selector with 6 tools.
3. Result workspace after generation.
4. Download CTA visibility.
5. Compare slider drag.
6. Preset Apply flow.
7. Dashboard navigation.
8. Auth pages.
9. Legal pages.

## 9. Production Log Review

After smoke test, review Vercel logs:

- No stack traces shown to users.
- No signed R2 URLs logged in production.
- No provider raw response bodies logged in production.
- No Stripe secrets or webhook payload secrets logged.
- Provider errors are visible enough for debugging but sanitized for users.

## 10. Launch Decision

Launch only when:

- All six tools pass smoke test.
- Free watermark and paid clean paths are verified.
- Auth and dashboard are stable.
- Stripe test checkout delivers credits.
- R2 signed downloads work.
- Legal/contact placeholders are replaced.
- Rate limit risk is accepted or Redis/Upstash migration is complete.
