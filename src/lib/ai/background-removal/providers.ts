import {
  backgroundRemoverConfig,
  getBackgroundRemovalComparisonAttempts,
  type BackgroundRemovalAttempt,
  type BackgroundRemovalModelInput,
  type BackgroundRemovalProviderKey
} from "@/config/ai-tools";
import {
  createReplicatePrediction,
  extractReplicateOutputUrl,
  ReplicateApiError,
  ReplicatePredictionError,
  waitForReplicatePrediction
} from "@/lib/ai/providers/replicate";
import {
  BackgroundRemovalProviderError,
  type BackgroundRemovalProviderInput,
  type BackgroundRemovalProviderResult,
  type BackgroundRemovalTarget
} from "./types";

const photoroomEndpoint = "https://sdk.photoroom.com/v1/segment";
const removeBgEndpoint = "https://api.remove.bg/v1.0/removebg";

export function getActiveBackgroundRemovalProvider(): BackgroundRemovalProviderKey {
  const configuredProvider = backgroundRemoverConfig.backgroundRemovalProvider;

  if (configuredProvider === "photoroom" && process.env.PHOTOROOM_API_KEY) return "photoroom";

  return "replicate";
}

export function getBackgroundRemovalComparisonTargets(): BackgroundRemovalTarget[] {
  const targets: BackgroundRemovalTarget[] = [];

  if (process.env.REPLICATE_API_TOKEN) {
    for (const attempt of getBackgroundRemovalComparisonAttempts()) {
      targets.push({
        providerKey: "replicate",
        key: attempt.key,
        label: attempt.model,
        attempt
      });
    }
  }

  if (process.env.PHOTOROOM_API_KEY) {
    targets.push({
      providerKey: "photoroom",
      key: "photoroom-remove-background-basic",
      label: "PhotoRoom Remove Background API",
      qualityTier: "high"
    });
  }

  if (process.env.REMOVEBG_API_KEY) {
    targets.push({
      providerKey: "removebg",
      key: "removebg-remove-background",
      label: "remove.bg API",
      qualityTier: "high"
    });
  }

  return targets;
}

export async function runBackgroundRemovalTarget(input: BackgroundRemovalProviderInput) {
  if (input.target.providerKey === "replicate") {
    return runReplicateTarget(input, input.target.attempt);
  }

  if (input.target.providerKey === "photoroom") {
    return runPhotoRoomTarget(input);
  }

  return runRemoveBgTarget(input);
}

export async function downloadProviderOutput(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not download provider output: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export function createReplicateBackgroundRemovalInput(inputType: BackgroundRemovalModelInput, imageUrl: string) {
  if (inputType === "bria-rmbg") {
    return {
      image: imageUrl,
      preserve_alpha: true,
      preserve_partial_alpha: true,
      content_moderation: false
    };
  }

  if (inputType === "remove-bg") {
    return {
      image: imageUrl
    };
  }

  return {
    image: imageUrl,
    format: "png",
    reverse: false,
    threshold: 0,
    background_type: "rgba"
  };
}

async function runReplicateTarget(input: BackgroundRemovalProviderInput, attempt: BackgroundRemovalAttempt): Promise<BackgroundRemovalProviderResult> {
  const startedAt = Date.now();
  let rawResponse: unknown;
  let providerRequestId: string | undefined;

  try {
    const prediction = await createReplicatePrediction({
      model: attempt.model,
      imageUrl: input.imageUrl,
      input: createReplicateBackgroundRemovalInput(attempt.inputType, input.imageUrl)
    });
    providerRequestId = prediction.id;
    rawResponse = prediction;

    const completed = await waitForReplicatePrediction({
      prediction,
      timeoutSeconds: backgroundRemoverConfig.timeoutSeconds,
      pollIntervalSeconds: backgroundRemoverConfig.pollIntervalSeconds
    });
    rawResponse = completed;

    const outputUrl = extractReplicateOutputUrl(completed);
    if (!outputUrl) {
      throw new Error("Replicate output URL is missing.");
    }

    return {
      providerKey: "replicate",
      targetKey: input.target.key,
      label: input.target.label,
      providerRequestId,
      model: attempt.model,
      qualityTier: attempt.qualityTier,
      outputBuffer: await downloadProviderOutput(outputUrl),
      contentType: "image/png",
      rawResponse,
      processingTimeMs: Date.now() - startedAt
    };
  } catch (error) {
    if (error instanceof ReplicateApiError) {
      rawResponse = error.responseJson ?? error.responseBody;
      throw toProviderError(error.message, input, startedAt, error.status, rawResponse);
    }

    if (error instanceof ReplicatePredictionError) {
      rawResponse = error.prediction;
      providerRequestId = providerRequestId ?? error.prediction.id;
    }

    throw toProviderError(error instanceof Error ? error.message : "Unknown Replicate error.", input, startedAt, null, rawResponse);
  }
}

async function runPhotoRoomTarget(input: BackgroundRemovalProviderInput): Promise<BackgroundRemovalProviderResult> {
  const startedAt = Date.now();
  const apiKey = process.env.PHOTOROOM_API_KEY;

  if (!apiKey) {
    throw toProviderError("Missing PHOTOROOM_API_KEY.", input, startedAt, null);
  }

  const imageBuffer = input.imageBuffer ?? await downloadProviderOutput(input.imageUrl);
  const formData = new FormData();
  formData.append("image_file", new Blob([toArrayBuffer(imageBuffer)], { type: input.mimeType || "image/jpeg" }), input.filename || "input.jpg");
  formData.append("format", "png");
  formData.append("channels", "rgba");
  formData.append("size", "full");

  const response = await fetchWithRetry(photoroomEndpoint, {
    method: "POST",
    headers: {
      "x-api-key": apiKey
    },
    body: formData
  }, {
    timeoutMs: backgroundRemoverConfig.timeoutSeconds * 1000,
    maxRetries: backgroundRemoverConfig.maxRetries
  });

  if (!response.ok) {
    const rawResponse = await readProviderError(response);
    throw toProviderError(`PhotoRoom background removal failed: ${response.status}`, input, startedAt, response.status, rawResponse);
  }

  return {
    providerKey: "photoroom",
    targetKey: input.target.key,
    label: input.target.label,
    qualityTier: "high",
    outputBuffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "image/png",
    rawResponse: {
      status: response.status,
      contentType: response.headers.get("content-type"),
      requestMode: "multipart_image_file"
    },
    processingTimeMs: Date.now() - startedAt
  };
}

async function runRemoveBgTarget(input: BackgroundRemovalProviderInput): Promise<BackgroundRemovalProviderResult> {
  const startedAt = Date.now();
  const apiKey = process.env.REMOVEBG_API_KEY;

  if (!apiKey) {
    throw toProviderError("Missing REMOVEBG_API_KEY.", input, startedAt, null);
  }

  const imageBuffer = input.imageBuffer ?? await downloadProviderOutput(input.imageUrl);
  const formData = new FormData();
  formData.append("image_file", new Blob([toArrayBuffer(imageBuffer)], { type: input.mimeType || "image/jpeg" }), input.filename || "input.jpg");
  formData.append("size", "auto");
  formData.append("format", "png");
  formData.append("type", "product");

  const response = await fetch(removeBgEndpoint, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey
    },
    body: formData
  });

  if (!response.ok) {
    const rawResponse = await readProviderError(response);
    throw toProviderError(`remove.bg background removal failed: ${response.status}`, input, startedAt, response.status, rawResponse);
  }

  return {
    providerKey: "removebg",
    targetKey: input.target.key,
    label: input.target.label,
    qualityTier: "high",
    outputBuffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "image/png",
    rawResponse: {
      status: response.status,
      contentType: response.headers.get("content-type"),
      requestMode: "multipart_image_file",
      type: "product"
    },
    processingTimeMs: Date.now() - startedAt
  };
}

async function readProviderError(response: Response) {
  const body = await response.text();

  try {
    return {
      status: response.status,
      body: JSON.parse(body) as unknown
    };
  } catch {
    return {
      status: response.status,
      body: body.slice(0, 1200)
    };
  }
}

function toProviderError(
  message: string,
  input: BackgroundRemovalProviderInput,
  startedAt: number,
  statusCode?: number | null,
  rawResponse?: unknown
) {
  return new BackgroundRemovalProviderError(message, {
    providerKey: input.target.providerKey,
    targetKey: input.target.key,
    statusCode,
    rawResponse,
    processingTimeMs: Date.now() - startedAt
  });
}

function toArrayBuffer(buffer: Buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

async function fetchWithRetry(url: string, init: RequestInit, options: { timeoutMs: number; maxRetries: number }) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init, options.timeoutMs);

      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === options.maxRetries) {
        return response;
      }

      await sleep(getRetryDelayMs(response, attempt));
    } catch (error) {
      lastError = error;
      if (attempt === options.maxRetries) break;
      await sleep(750 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Provider request failed after retry.");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 10) {
    return retryAfter * 1000;
  }

  return 750 * (attempt + 1);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
