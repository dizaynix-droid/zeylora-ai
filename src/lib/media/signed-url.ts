import { createPrivateDownloadUrl, createPrivateReadUrl } from "@/lib/storage/s3-client";

export async function createResultPreviewUrl(storageKey?: string | null) {
  if (!storageKey) return null;

  return createPrivateReadUrl(storageKey, Number(process.env.RESULT_SIGNED_URL_TTL_SECONDS || 1800));
}

export async function createResultDownloadUrl(storageKey?: string | null, filename = "zeylora-background-remover.png") {
  if (!storageKey) return null;

  return createPrivateDownloadUrl(
    storageKey,
    filename,
    Number(process.env.RESULT_SIGNED_URL_TTL_SECONDS || 1800)
  );
}
