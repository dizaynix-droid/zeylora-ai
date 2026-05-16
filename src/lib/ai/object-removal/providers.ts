import { objectRemoverConfig, type ObjectRemovalQualityMode } from "@/config/ai-tools";
import {
  createReplicatePrediction,
  extractReplicateOutputUrl,
  ReplicateApiError,
  ReplicatePredictionError,
  waitForReplicatePrediction
} from "@/lib/ai/providers/replicate";

export type ObjectRemovalResult = {
  providerKey: "replicate" | "photoroom";
  providerRequestId: string;
  model: string;
  modelKey: string;
  outputUrl?: string;
  outputBuffer?: Buffer;
  rawResponse: unknown;
  processingTimeMs: number;
  qualityMode: ObjectRemovalQualityMode;
  prompt: string;
};

export class ObjectRemovalProviderError extends Error {
  providerKey: "replicate" | "photoroom";
  statusCode?: number | null;
  rawResponse?: unknown;
  processingTimeMs: number;

  constructor(message: string, input: {
    providerKey?: "replicate" | "photoroom";
    statusCode?: number | null;
    rawResponse?: unknown;
    processingTimeMs: number;
  }) {
    super(message);
    this.name = "ObjectRemovalProviderError";
    this.providerKey = input.providerKey || "replicate";
    this.statusCode = input.statusCode;
    this.rawResponse = input.rawResponse;
    this.processingTimeMs = input.processingTimeMs;
  }
}

export async function runObjectRemoval(input: {
  imageUrl: string;
  prompt: string;
  qualityMode: ObjectRemovalQualityMode;
  modelOverride?: string | null;
  preferredProvider?: "replicate" | "photoroom";
}): Promise<ObjectRemovalResult> {
  if (input.preferredProvider === "photoroom") {
    try {
      return await runPhotoRoomTextRemoval(input);
    } catch (error) {
      if (!process.env.REPLICATE_API_TOKEN) throw error;
      console.warn("[object-remover] PhotoRoom text removal failed; falling back to Replicate.", {
        statusCode: error instanceof ObjectRemovalProviderError ? error.statusCode : undefined,
        message: error instanceof Error ? error.message : "Unknown PhotoRoom error"
      });
    }
  }

  const startedAt = Date.now();
  const model = input.modelOverride || (input.qualityMode === "pro" ? objectRemoverConfig.proModel : objectRemoverConfig.model);
  let providerRequestId: string | undefined;
  let rawResponse: unknown;

  return (async () => {
    const prediction = await createReplicatePrediction({
      model,
      imageUrl: input.imageUrl,
      input: createObjectRemovalInput({
        imageUrl: input.imageUrl,
        prompt: input.prompt,
        qualityMode: input.qualityMode,
        model
      })
    });
    providerRequestId = prediction.id;
    rawResponse = prediction;

    const completed = await waitForReplicatePrediction({
      prediction,
      timeoutSeconds: objectRemoverConfig.timeoutSeconds,
      pollIntervalSeconds: objectRemoverConfig.pollIntervalSeconds
    });
    rawResponse = completed;

    const outputUrl = extractReplicateOutputUrl(completed);
    if (!outputUrl) {
      throw new Error("Replicate object removal output URL is missing.");
    }

    return {
      providerKey: "replicate" as const,
      providerRequestId,
      model,
      modelKey: `replicate-object-removal:${input.qualityMode}`,
      outputUrl,
      rawResponse,
      processingTimeMs: Date.now() - startedAt,
      qualityMode: input.qualityMode,
      prompt: input.prompt
    };
  })().catch((error: unknown) => {
    if (error instanceof ReplicateApiError) {
      throw toObjectRemovalError(error.message, startedAt, error.status, error.responseJson ?? error.responseBody);
    }

    if (error instanceof ReplicatePredictionError) {
      rawResponse = error.prediction;
      providerRequestId = providerRequestId ?? error.prediction.id;
    }

    throw toObjectRemovalError(
      error instanceof Error ? error.message : "Unknown object removal error.",
      startedAt,
      null,
      rawResponse
    );
  });
}

async function runPhotoRoomTextRemoval(input: {
  imageUrl: string;
  prompt: string;
  qualityMode: ObjectRemovalQualityMode;
}): Promise<ObjectRemovalResult> {
  const startedAt = Date.now();
  const apiKey = process.env.PHOTOROOM_API_KEY;

  if (!apiKey) {
    throw toObjectRemovalError("Missing PHOTOROOM_API_KEY.", startedAt, null, undefined, "photoroom");
  }

  const url = new URL("https://image-api.photoroom.com/v2/edit");
  url.searchParams.set("imageUrl", input.imageUrl);
  url.searchParams.set("textRemoval.mode", "ai.all");
  url.searchParams.set("removeBackground", "false");
  url.searchParams.set("referenceBox", "originalImage");
  url.searchParams.set("export.format", "png");

  const response = await fetchWithRetry(url.toString(), {
    method: "GET",
    headers: {
      "x-api-key": apiKey
    }
  }, {
    timeoutMs: objectRemoverConfig.timeoutSeconds * 1000,
    maxRetries: objectRemoverConfig.maxRetries
  });

  if (!response.ok) {
    const rawResponse = await readProviderError(response);
    throw toObjectRemovalError(`PhotoRoom text removal failed: ${response.status}`, startedAt, response.status, rawResponse, "photoroom");
  }

  return {
    providerKey: "photoroom",
    providerRequestId: response.headers.get("x-request-id") || `photoroom-text-removal-${Date.now()}`,
    model: "photoroom-image-edit-v2",
    modelKey: `photoroom-text-removal:${input.qualityMode}`,
    outputBuffer: Buffer.from(await response.arrayBuffer()),
    rawResponse: {
      status: response.status,
      contentType: response.headers.get("content-type"),
      requestMode: "image_url",
      textRemovalMode: "ai.all"
    },
    processingTimeMs: Date.now() - startedAt,
    qualityMode: input.qualityMode,
    prompt: input.prompt
  };
}

function createObjectRemovalInput(input: {
  imageUrl: string;
  prompt: string;
  qualityMode: ObjectRemovalQualityMode;
  model: string;
}) {
  void input.qualityMode;
  if (input.model.includes("adirik/inst-inpaint")) {
    return {
      image: input.imageUrl,
      instruction: input.prompt
    };
  }

  return {
    image: input.imageUrl,
    prompt: input.prompt
  };
}

function toObjectRemovalError(
  message: string,
  startedAt: number,
  statusCode?: number | null,
  rawResponse?: unknown,
  providerKey: "replicate" | "photoroom" = "replicate"
) {
  return new ObjectRemovalProviderError(message, {
    providerKey,
    statusCode,
    rawResponse,
    processingTimeMs: Date.now() - startedAt
  });
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

async function fetchWithRetry(url: string, init: RequestInit, options: { timeoutMs: number; maxRetries: number }) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init, options.timeoutMs);

      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === options.maxRetries) {
        return response;
      }

      await sleep(750 * (attempt + 1));
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
