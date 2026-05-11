export const storagePolicy = {
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFileSizeMb: 12,
  maxWidth: 6000,
  maxHeight: 6000,
  tempUploadTtlHours: 24,
  generatedResultTtlDays: 30,
  publicCacheControl: "public, max-age=31536000, immutable",
  privateCacheControl: "private, max-age=0, no-store"
} as const;

export function getCacheControl(visibility: "public" | "private" | "temp") {
  return visibility === "public" ? storagePolicy.publicCacheControl : storagePolicy.privateCacheControl;
}
