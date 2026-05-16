import sharp from "sharp";
import { getCacheControl } from "@/lib/storage/policy";
import { createPrivateReadUrl, uploadPrivateObject } from "@/lib/storage/s3-client";

export async function preparePhotoEnhancementProviderInput(input: {
  inputUrl: string;
  inputStorageKey: string;
  userId: string;
  jobId: string;
  toolKey: string;
}) {
  const sourceBuffer = await downloadSource(input.inputUrl);
  const image = sharp(sourceBuffer, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const pixels = width * height;
  const maxProviderPixels = 1_900_000;

  if (!width || !height || pixels <= maxProviderPixels) {
    return {
      url: input.inputUrl,
      resized: false,
      originalWidth: width,
      originalHeight: height,
      originalPixels: pixels,
      providerWidth: width,
      providerHeight: height,
      providerPixels: pixels,
      providerStorageKey: input.inputStorageKey
    };
  }

  const ratio = Math.sqrt(maxProviderPixels / pixels);
  const providerWidth = Math.max(1, Math.floor(width * ratio));
  const providerHeight = Math.max(1, Math.floor(height * ratio));
  const providerBuffer = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .resize({
      width: providerWidth,
      height: providerHeight,
      fit: "inside",
      withoutEnlargement: true
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const providerStorageKey = `provider-inputs/${input.userId}/${input.jobId}/${input.toolKey}-provider-input.png`;

  await uploadPrivateObject({
    key: providerStorageKey,
    body: providerBuffer,
    contentType: "image/png",
    cacheControl: getCacheControl("private"),
    metadata: {
      userId: input.userId,
      jobId: input.jobId,
      source: `${input.toolKey}-provider-input`,
      originalWidth: String(width),
      originalHeight: String(height),
      providerWidth: String(providerWidth),
      providerHeight: String(providerHeight)
    }
  });

  const providerUrl = await createPrivateReadUrl(providerStorageKey);

  return {
    url: providerUrl,
    resized: true,
    originalWidth: width,
    originalHeight: height,
    originalPixels: pixels,
    providerWidth,
    providerHeight,
    providerPixels: providerWidth * providerHeight,
    providerStorageKey
  };
}

async function downloadSource(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download provider input: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
