import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = "auto";

export function getStorageConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint =
    process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Storage is not configured. Missing R2/S3 environment variables.");
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey
  };
}

export function createStorageClient() {
  const config = getStorageConfig();

  return new S3Client({
    region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    forcePathStyle: true
  });
}

export async function uploadPrivateObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl: string;
  metadata?: Record<string, string>;
}) {
  const config = getStorageConfig();
  const client = createStorageClient();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl,
      Metadata: input.metadata
    })
  );
}

export async function createPrivateReadUrl(key: string, expiresIn?: number) {
  const config = getStorageConfig();
  const client = createStorageClient();
  const ttl = expiresIn ?? Number(process.env.UPLOAD_SIGNED_URL_TTL_SECONDS || 900);

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key
    }),
    {
      expiresIn: ttl
    }
  );
}

export async function createPrivateDownloadUrl(key: string, filename: string, expiresIn?: number) {
  const config = getStorageConfig();
  const client = createStorageClient();
  const ttl = expiresIn ?? Number(process.env.RESULT_SIGNED_URL_TTL_SECONDS || 1800);

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${sanitizeDownloadFilename(filename)}"`
    }),
    {
      expiresIn: ttl
    }
  );
}

export function buildUploadStorageKey(input: { userId: string; mediaId: string; extension: string }) {
  return `uploads/${input.userId}/${input.mediaId}/original.${input.extension}`;
}

export function buildResultStorageKey(input: { userId: string; jobId: string; filename: string }) {
  return `results/${input.userId}/${input.jobId}/${input.filename}`;
}

function sanitizeDownloadFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}
