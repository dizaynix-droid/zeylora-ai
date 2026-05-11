# Zeylora AI Phase 2 Status

> Phase 5 note: the temporary `x-zeylora-user-id` development header has been replaced by real Supabase Auth sessions in active API code. Use `PHASE_5_AUTH.md` for current sign-in and upload testing.

## Phase 2A Completed

- Protected upload API foundation.
- Login-required upload policy.
- No guest upload/job creation.
- R2/S3-compatible storage client.
- Private object upload helper.
- Signed private read URL helper.
- Upload storage key convention.
- JPG, PNG, and WebP validation.
- File size validation.
- Image dimension validation.
- Magic-byte image validation.
- SHA-256 checksum creation.
- `media_assets` real database records for uploads.
- No raw storage URL exposure in API response.

## Phase 2B Completed

- Background Remover only.
- Replicate provider client via `fetch`.
- Primary model: `851-labs/background-remover`.
- Fallback model: `lucataco/remove-bg`.
- Protected job creation endpoint.
- Input media ownership verification.
- `AiJob` creation with `creditCost: 2` recorded only.
- No credit deduction, refund, payments, or subscriptions.
- Job event timeline model added.
- Provider attempt logs.
- Signed input URL sent to Replicate.
- Replicate polling with timeout.
- Provider output download.
- Output upload to private R2/S3 path.
- Output `MediaAsset` creation.
- Signed result preview URL response.
- Basic dashboard job/result card.

## Phase 2B Endpoint

```txt
POST /api/v1/jobs/background-remover
```

Authentication:

```txt
Supabase Auth session cookie required.
```

Body:

```json
{
  "inputMediaId": "<private upload media id>"
}
```

Success response:

```json
{
  "ok": true,
  "job": {
    "id": "...",
    "status": "COMPLETED",
    "creditCost": 2,
    "processingTimeMs": 4200,
    "completedAt": "..."
  },
  "outputMedia": {
    "id": "...",
    "mimeType": "image/png",
    "fileSize": 123456,
    "createdAt": "..."
  },
  "preview": {
    "signedUrl": "https://...",
    "expiresInSeconds": 1800
  }
}
```

## Required Phase 2B Env Variables

```env
REPLICATE_API_TOKEN=""
AI_BACKGROUND_REMOVER_MODEL="851-labs/background-remover"
AI_BACKGROUND_REMOVER_FALLBACK_MODEL="lucataco/remove-bg"
AI_JOB_TIMEOUT_SECONDS="60"
AI_JOB_MAX_RETRIES="1"
AI_JOB_POLL_INTERVAL_SECONDS="2"
RESULT_SIGNED_URL_TTL_SECONDS="1800"
```

Phase 2A storage env is still required:

```env
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_ENDPOINT=""
UPLOAD_SIGNED_URL_TTL_SECONDS="900"
```

## Database Changes

New Prisma model:

```txt
JobEvent
```

SQL Editor fallback file:

```txt
database/supabase/phase_2b_job_events.sql
```

Run this in Supabase SQL Editor if Prisma migrate cannot connect.

## Admin Language Decision

- Public-facing website remains English.
- Admin panel defaults to Turkish.
- Admin text is stored in translation/config file:

```txt
src/i18n/admin/tr.ts
```

- Technical database/model names remain English.

## Not Started Yet

- Guest upload.
- Multiple AI tools.
- Full credit enforcement.
- Credit refund automation.
- Payments/subscriptions.
- Dedicated queue worker.
- Advanced admin job monitoring UI.

## Future Tool Note

- Portrait Cutout should be a separate future tool optimized for people, hair, hands, shoes, and full-body poses.
- Current Background Remover positioning should stay focused on product photos, objects, and clean foregrounds until a dedicated portrait pipeline is added.

## Background Remover Provider Comparison Layer

- Fast and Standard Background Remover modes use Replicate.
- High Quality Background Remover mode uses PhotoRoom API.
- Main runtime provider switch values:

```env
BACKGROUND_REMOVAL_PROVIDER="replicate"
```

- Supported values:

```txt
replicate
photoroom
```

- PhotoRoom env:

```env
PHOTOROOM_API_KEY=""
```

- PhotoRoom is required for High Quality mode.
- A live/production PhotoRoom API key is expected to return clean PNG output without sandbox watermarking; if `PHOTOROOM_API_KEY` is empty in local development, High Quality safely records a job event and falls back to Replicate Standard so the upload flow remains testable.
- Upload, R2 storage, dashboard history, signed downloads, ratings, and job events remain unchanged.
- Development-only comparison endpoint:

```txt
POST /api/dev/background-remover/compare
```

- The comparison endpoint runs the same uploaded image through available targets and stores outputs separately under private R2 comparison paths for visual review.
- Current comparison focus is product/object photos and clean foregrounds, not perfect full-body human cutouts.

## Phase 2D Photo Enhancer Preparation

- Internal placeholder config:

```txt
src/config/future-tools.ts
```

- Photo Enhancer is now the Phase 3 MVP second real tool under `Enhancement`.
- It reuses protected upload, media asset records, AI jobs, provider abstraction, R2 result storage, signed preview/download URLs, dashboard history, and ratings.
- Initial MVP provider is Replicate Real-ESRGAN (`nightmareai/real-esrgan`) with a conservative 2x enhancement setting.
- Provider research notes:
  - Real-ESRGAN: good MVP default for ecommerce photos, social images, compression cleanup, and low-resolution assets.
  - GFPGAN/CodeFormer: future Portrait Enhancer or Face Restore candidates, not default for product photos.
  - Clarity/Topaz-style premium upscalers: future HD Upscale candidates after cost and quality testing.
  - Stability upscale: future research candidate for creative or high-detail upscaling.
- No payments, subscriptions, credit enforcement, queue rewrite, mobile app, or auth rewrite has started yet.

## Future Enhancement Tools

- Portrait Enhancer.
- Face Restore.
- HD Upscale.
- Relight.
