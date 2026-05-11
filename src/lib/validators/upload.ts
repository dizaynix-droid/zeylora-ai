import { z } from "zod";

export const uploadRules = {
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFileSizeMb: 12,
  maxWidth: 6000,
  maxHeight: 6000
};

export const uploadMetadataSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  fileSize: z.number().positive().max(uploadRules.maxFileSizeMb * 1024 * 1024),
  width: z.number().positive().max(uploadRules.maxWidth).optional(),
  height: z.number().positive().max(uploadRules.maxHeight).optional()
});
