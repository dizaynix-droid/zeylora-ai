import { createHash } from "node:crypto";
import { storagePolicy } from "@/lib/storage/policy";

const mimeToExtension = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

export type AllowedImageMimeType = keyof typeof mimeToExtension;

export type ValidatedUpload = {
  buffer: Buffer;
  mimeType: AllowedImageMimeType;
  extension: string;
  fileSize: number;
  width: number;
  height: number;
  checksum: string;
  originalFilename: string;
};

export type UploadValidationError = {
  code:
    | "missing_file"
    | "invalid_file"
    | "unsupported_type"
    | "file_too_large"
    | "invalid_image"
    | "image_too_large";
  message: string;
};

export async function validateImageUpload(file: unknown): Promise<
  | {
      ok: true;
      upload: ValidatedUpload;
    }
  | {
      ok: false;
      error: UploadValidationError;
    }
> {
  if (!(file instanceof File)) {
    return {
      ok: false,
      error: {
        code: "missing_file",
        message: "Please choose an image file to upload."
      }
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      error: {
        code: "invalid_file",
        message: "The selected file is empty."
      }
    };
  }

  const maxBytes = getMaxUploadSizeBytes();
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: {
        code: "file_too_large",
        message: `Image must be ${Math.floor(maxBytes / 1024 / 1024)}MB or smaller.`
      }
    };
  }

  const declaredType = file.type;
  if (!isAllowedMimeType(declaredType)) {
    return {
      ok: false,
      error: {
        code: "unsupported_type",
        message: "Only JPG, PNG, and WebP images are supported."
      }
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImage(buffer);

  if (!detected || detected.mimeType !== declaredType) {
    return {
      ok: false,
      error: {
        code: "invalid_image",
        message: "The uploaded file does not look like a valid image."
      }
    };
  }

  const maxWidth = Number(process.env.MAX_IMAGE_WIDTH || storagePolicy.maxWidth);
  const maxHeight = Number(process.env.MAX_IMAGE_HEIGHT || storagePolicy.maxHeight);

  if (detected.width > maxWidth || detected.height > maxHeight) {
    return {
      ok: false,
      error: {
        code: "image_too_large",
        message: `Image dimensions must be ${maxWidth}x${maxHeight}px or smaller.`
      }
    };
  }

  return {
    ok: true,
    upload: {
      buffer,
      mimeType: detected.mimeType,
      extension: mimeToExtension[detected.mimeType],
      fileSize: buffer.length,
      width: detected.width,
      height: detected.height,
      checksum: createHash("sha256").update(buffer).digest("hex"),
      originalFilename: sanitizeFilename(file.name || "upload")
    }
  };
}

function getMaxUploadSizeBytes() {
  const configured = Number(process.env.MAX_UPLOAD_SIZE_MB || storagePolicy.maxFileSizeMb);
  return configured * 1024 * 1024;
}

function isAllowedMimeType(value: string): value is AllowedImageMimeType {
  return Object.keys(mimeToExtension).includes(value);
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^\w.\- ]+/g, "").trim().slice(0, 160) || "upload";
}

function detectImage(buffer: Buffer): { mimeType: AllowedImageMimeType; width: number; height: number } | null {
  return detectPng(buffer) || detectJpeg(buffer) || detectWebp(buffer);
}

function detectPng(buffer: Buffer) {
  const isPng =
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (!isPng) return null;

  return {
    mimeType: "image/png" as const,
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function detectJpeg(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);

    if (isJpegStartOfFrame(marker)) {
      return {
        mimeType: "image/jpeg" as const,
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    offset += 2 + length;
  }

  return null;
}

function isJpegStartOfFrame(marker: number) {
  return (
    marker === 0xc0 ||
    marker === 0xc1 ||
    marker === 0xc2 ||
    marker === 0xc3 ||
    marker === 0xc5 ||
    marker === 0xc6 ||
    marker === 0xc7 ||
    marker === 0xc9 ||
    marker === 0xca ||
    marker === 0xcb ||
    marker === 0xcd ||
    marker === 0xce ||
    marker === 0xcf
  );
}

function detectWebp(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  const chunk = buffer.toString("ascii", 12, 16);

  if (chunk === "VP8X" && buffer.length >= 30) {
    return {
      mimeType: "image/webp" as const,
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }

  if (chunk === "VP8 " && buffer.length >= 30) {
    return {
      mimeType: "image/webp" as const,
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }

  if (chunk === "VP8L" && buffer.length >= 25) {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];

    return {
      mimeType: "image/webp" as const,
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
    };
  }

  return null;
}
