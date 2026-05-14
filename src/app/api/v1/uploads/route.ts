import { randomUUID } from "node:crypto";
import { MediaProcessingStatus, MediaType, MediaVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import { prisma } from "@/lib/db";
import { buildUploadStorageKey, createPrivateReadUrl, uploadPrivateObject } from "@/lib/storage/s3-client";
import { getCacheControl } from "@/lib/storage/policy";
import { validateImageUpload } from "@/lib/validators/image-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "You must be logged in to upload images."
      },
      { status: 401 }
    );
  }

  const rateLimit = checkRateLimit(request, {
    action: "upload",
    userId: user.id,
    role: user.role
  });

  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const validated = await validateImageUpload(file);

  if (!validated.ok) {
    console.warn("[security-upload-blocked]", {
      userId: user.id,
      code: validated.error.code
    });
    return NextResponse.json(
      {
        ok: false,
        error: validated.error.message,
        code: validated.error.code
      },
      { status: 400 }
    );
  }

  const mediaId = randomUUID();
  const storageKey = buildUploadStorageKey({
    userId: user.id,
    mediaId,
    extension: validated.upload.extension
  });
  const cacheControl = getCacheControl("private");

  try {
    await uploadPrivateObject({
      key: storageKey,
      body: validated.upload.buffer,
      contentType: validated.upload.mimeType,
      cacheControl,
      metadata: {
        userId: user.id,
        mediaId,
        checksum: validated.upload.checksum
      }
    });

    const media = await prisma.mediaAsset.create({
      data: {
        id: mediaId,
        userId: user.id,
        type: MediaType.UPLOAD,
        storageKey,
        originalFilename: validated.upload.originalFilename,
        checksum: validated.upload.checksum,
        mimeType: validated.upload.mimeType,
        fileSize: validated.upload.fileSize,
        width: validated.upload.width,
        height: validated.upload.height,
        visibility: MediaVisibility.PRIVATE,
        processingStatus: MediaProcessingStatus.STORED,
        cacheControl,
        metadataJson: {
          source: "protected_upload_api",
          uploadedBy: user.id
        }
      },
      select: {
        id: true,
        type: true,
        mimeType: true,
        fileSize: true,
        width: true,
        height: true,
        createdAt: true
      }
    });

    const signedUrl = await createPrivateReadUrl(storageKey);

    return NextResponse.json({
      ok: true,
      media,
      preview: {
        signedUrl,
        expiresInSeconds: Number(process.env.UPLOAD_SIGNED_URL_TTL_SECONDS || 900)
      }
    });
  } catch (error) {
    console.error("Upload failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Upload could not be completed. Please try again."
      },
      { status: 500 }
    );
  }
}
