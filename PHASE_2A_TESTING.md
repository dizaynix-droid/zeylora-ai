# Zeylora AI Phase 2A Upload Testing Guide

> Historical note: Phase 2A used a temporary dev user/header flow. Phase 5 replaced active upload/job authentication with Supabase Auth sessions. Use `PHASE_5_AUTH.md` for current local testing.

This guide tests only the real protected upload flow with R2/S3 storage.

Do not test Replicate, AI jobs, credits, queue, or guest upload in this phase.

## What Phase 2A Tests

- Logged-in-only upload protection.
- JPG, PNG, WebP validation.
- File size validation.
- Image dimension validation.
- R2/S3 private upload.
- `media_assets` database record creation.
- Temporary signed preview URL.
- No raw storage URL exposure.

## Required `.env.local` Fields

Fill these before testing:

```env
DATABASE_URL="postgresql://prisma.PROJECT_REF:PRISMA_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://prisma.PROJECT_REF:PRISMA_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_NAME="Zeylora AI"

R2_ACCOUNT_ID="your_cloudflare_account_id"
R2_ACCESS_KEY_ID="your_r2_access_key_id"
R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
R2_BUCKET_NAME="your_bucket_name"
R2_ENDPOINT="https://your_cloudflare_account_id.r2.cloudflarestorage.com"

UPLOAD_SIGNED_URL_TTL_SECONDS="900"
MAX_UPLOAD_SIZE_MB="12"
MAX_IMAGE_WIDTH="6000"
MAX_IMAGE_HEIGHT="6000"
```

`R2_PUBLIC_BASE_URL` is not required for Phase 2A because uploads are private and read through signed URLs.

## R2 Bucket Settings

Create one private R2 bucket, for example:

```txt
zeylora-ai-dev
```

Recommended settings:

- Public access: disabled.
- Object access: private.
- Do not expose a public bucket URL for user uploads.
- Create R2 API token/access keys with permission for this bucket.

Required API permissions:

- Object read.
- Object write.

Recommended CORS for future browser-direct uploads:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Current Phase 2A uploads go through the Next.js API route, so CORS is not the main blocker yet. Signed preview URLs may be opened by the browser.

## Prisma Migration Command

Run this after `.env.local` points to your local/dev PostgreSQL database:

```bash
npm run prisma:migrate -- --name phase_2a_media_uploads
```

Then generate Prisma client:

```bash
npm run prisma:generate
```

## Seed Test User

The seed creates a safe dev user:

```txt
dev-upload-tester@zeylora.local
```

Run:

```bash
npm run db:seed
```

The seed prints:

```txt
Dev upload test user id: <USER_ID>
```

Copy that id. It is the temporary login substitute for Phase 2A.

If you missed the output, fetch it with Prisma Studio:

```bash
npm run prisma:studio
```

Open the `User` table and copy the id for:

```txt
dev-upload-tester@zeylora.local
```

## Start Local Server

```bash
npm run dev
```

The app should run at:

```txt
http://localhost:3000
```

## Test Upload With Curl

Replace `<USER_ID>` and `/path/to/photo.jpg`.

```bash
curl -i \
  -X POST "http://localhost:3000/api/v1/uploads" \
  -H "x-zeylora-user-id: <USER_ID>" \
  -F "file=@/path/to/photo.jpg"
```

Expected success:

```json
{
  "ok": true,
  "media": {
    "id": "...",
    "type": "UPLOAD",
    "mimeType": "image/jpeg",
    "fileSize": 123456,
    "width": 1200,
    "height": 800,
    "createdAt": "..."
  },
  "preview": {
    "signedUrl": "https://...",
    "expiresInSeconds": 900
  }
}
```

Important:

- Response should not include `storageKey`.
- Response should not include raw bucket URL.
- `preview.signedUrl` should open temporarily in a browser.

## Test Upload From Browser DevTools

1. Run local app:

```bash
npm run dev
```

2. Open:

```txt
http://localhost:3000
```

3. Open browser DevTools Console.

4. Paste this helper, replacing `<USER_ID>`:

```js
async function testZeyloraUpload(userId) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp";
  input.onchange = async () => {
    const file = input.files[0];
    const form = new FormData();
    form.append("file", file);

    const response = await fetch("/api/v1/uploads", {
      method: "POST",
      headers: {
        "x-zeylora-user-id": userId
      },
      body: form
    });

    const json = await response.json();
    console.log(json);

    if (json.preview?.signedUrl) {
      window.open(json.preview.signedUrl, "_blank");
    }
  };
  input.click();
}

testZeyloraUpload("<USER_ID>");
```

## Verify Database Record

Open Prisma Studio:

```bash
npm run prisma:studio
```

Check `MediaAsset`:

- `userId` matches the test user.
- `type` is `UPLOAD`.
- `visibility` is `PRIVATE`.
- `processingStatus` is `STORED`.
- `originalFilename` exists.
- `checksum` exists.
- `storageKey` follows:

```txt
uploads/{userId}/{mediaId}/original.{extension}
```

## Common Errors And Fixes

### 401: You must be logged in to upload images

Cause:

- Missing or wrong `x-zeylora-user-id`.
- User does not exist.
- User is not `ACTIVE`.
- User has `deletedAt`.

Fix:

```bash
npm run db:seed
```

Copy the printed dev user id and retry.

### 400: Only JPG, PNG, and WebP images are supported

Cause:

- Unsupported file type.
- Browser/file has wrong MIME type.

Fix:

- Test with a normal `.jpg`, `.png`, or `.webp`.

### 400: The uploaded file does not look like a valid image

Cause:

- File extension/MIME says image but file content is not valid.
- Corrupted image.

Fix:

- Try another real image.

### 400: Image dimensions must be 6000x6000px or smaller

Cause:

- Image is too large.

Fix:

- Resize image.
- Or adjust `MAX_IMAGE_WIDTH` / `MAX_IMAGE_HEIGHT` for local testing.

### 500: Storage is not configured

Cause:

- Missing R2/S3 env fields.

Fix:

- Fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`.
- Restart `npm run dev`.

### 500: Upload could not be completed

Possible causes:

- Wrong R2 endpoint.
- Wrong R2 credentials.
- Token lacks read/write permission.
- Bucket name mismatch.

Fix:

- Confirm bucket exists.
- Confirm endpoint format:

```txt
https://<account_id>.r2.cloudflarestorage.com
```

- Confirm access keys are for R2 and have object read/write access.

### Signed URL opens Access Denied

Possible causes:

- Wrong secret/access key.
- Bucket/key mismatch.
- Signed URL expired.

Fix:

- Retry upload.
- Increase `UPLOAD_SIGNED_URL_TTL_SECONDS` locally if needed.

## Safety Notes

- Phase 2A intentionally does not support guest upload.
- Do not make upload bucket public.
- Do not expose raw storage keys in UI.
- Do not add AI job creation yet.
- Do not deduct credits yet.
