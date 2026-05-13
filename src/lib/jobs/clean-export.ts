import type { Prisma } from "@prisma/client";

export const CLEAN_EXPORT_UNLOCK_NOTE = "Clean export unlock";

type CleanExportMetadata = {
  storageKey: string;
  filename: string;
  contentType: string;
  fileSize: number;
  exportMode: "paid_clean";
};

export function buildCleanExportStorageKey(input: { userId: string; jobId: string; filename: string }) {
  return `results/${input.userId}/${input.jobId}/clean-${sanitizeCleanFilename(input.filename)}`;
}

export function createCleanExportMetadata(input: {
  storageKey: string;
  filename: string;
  contentType?: string;
  fileSize: number;
}): CleanExportMetadata {
  return {
    storageKey: input.storageKey,
    filename: input.filename,
    contentType: input.contentType || "image/png",
    fileSize: input.fileSize,
    exportMode: "paid_clean"
  };
}

export function mergeCleanExportMetadata<T extends Record<string, unknown>>(
  metadata: T,
  cleanExport: CleanExportMetadata
): Prisma.InputJsonObject {
  return {
    ...metadata,
    cleanExport
  } as Prisma.InputJsonObject;
}

export function getCleanExportMetadata(metadata: Prisma.JsonValue | null | undefined): CleanExportMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).cleanExport;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const cleanExport = value as Record<string, unknown>;

  if (typeof cleanExport.storageKey !== "string" || typeof cleanExport.filename !== "string") {
    return null;
  }

  return {
    storageKey: cleanExport.storageKey,
    filename: cleanExport.filename,
    contentType: typeof cleanExport.contentType === "string" ? cleanExport.contentType : "image/png",
    fileSize: typeof cleanExport.fileSize === "number" ? cleanExport.fileSize : 0,
    exportMode: "paid_clean"
  };
}

function sanitizeCleanFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}
