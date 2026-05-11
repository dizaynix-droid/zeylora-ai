import { hdUpscaleConfig, photoEnhancerConfig, type HdUpscalePreset } from "@/config/ai-tools";
import {
  createReplicatePrediction,
  extractReplicateOutputUrl,
  ReplicateApiError,
  ReplicatePredictionError,
  waitForReplicatePrediction
} from "@/lib/ai/providers/replicate";

export type PhotoEnhancementResult = {
  providerKey: "replicate";
  providerRequestId: string;
  model: string;
  modelKey: string;
  outputUrl: string;
  rawResponse: unknown;
  processingTimeMs: number;
};

type UpscaleRunConfig = {
  model: string;
  modelKey: string;
  scale: number;
  faceEnhance: boolean;
  timeoutSeconds: number;
  pollIntervalSeconds: number;
};

export class PhotoEnhancementProviderError extends Error {
  providerKey: "replicate";
  statusCode?: number | null;
  rawResponse?: unknown;
  processingTimeMs: number;

  constructor(message: string, input: {
    statusCode?: number | null;
    rawResponse?: unknown;
    processingTimeMs: number;
  }) {
    super(message);
    this.name = "PhotoEnhancementProviderError";
    this.providerKey = "replicate";
    this.statusCode = input.statusCode;
    this.rawResponse = input.rawResponse;
    this.processingTimeMs = input.processingTimeMs;
  }
}

export async function runPhotoEnhancement(input: { imageUrl: string }): Promise<PhotoEnhancementResult> {
  return runReplicateUpscale(input, {
    model: photoEnhancerConfig.model,
    modelKey: "replicate-real-esrgan",
    scale: photoEnhancerConfig.scale,
    faceEnhance: photoEnhancerConfig.faceEnhance,
    timeoutSeconds: photoEnhancerConfig.timeoutSeconds,
    pollIntervalSeconds: photoEnhancerConfig.pollIntervalSeconds
  });
}

export async function runHdUpscale(input: {
  imageUrl: string;
  preset: HdUpscalePreset;
}): Promise<PhotoEnhancementResult & { preset: HdUpscalePreset; presetLabel: string; scale: number }> {
  const presetConfig = hdUpscaleConfig.presets[input.preset];
  const result = await runReplicateUpscale(input, {
    model: hdUpscaleConfig.model,
    modelKey: `replicate-real-esrgan:${input.preset}`,
    scale: presetConfig.scale,
    faceEnhance: presetConfig.faceEnhance,
    timeoutSeconds: hdUpscaleConfig.timeoutSeconds,
    pollIntervalSeconds: hdUpscaleConfig.pollIntervalSeconds
  });

  return {
    ...result,
    preset: input.preset,
    presetLabel: presetConfig.label,
    scale: presetConfig.scale
  };
}

function runReplicateUpscale(input: { imageUrl: string }, config: UpscaleRunConfig): Promise<PhotoEnhancementResult> {
  const startedAt = Date.now();
  let providerRequestId: string | undefined;
  let rawResponse: unknown;

  return (async () => {
    const prediction = await createReplicatePrediction({
      model: config.model,
      imageUrl: input.imageUrl,
      input: {
        image: input.imageUrl,
        scale: config.scale,
        face_enhance: config.faceEnhance
      }
    });
    providerRequestId = prediction.id;
    rawResponse = prediction;

    const completed = await waitForReplicatePrediction({
      prediction,
      timeoutSeconds: config.timeoutSeconds,
      pollIntervalSeconds: config.pollIntervalSeconds
    });
    rawResponse = completed;

    const outputUrl = extractReplicateOutputUrl(completed);
    if (!outputUrl) {
      throw new Error("Replicate enhancement output URL is missing.");
    }

    return {
      providerKey: "replicate" as const,
      providerRequestId,
      model: config.model,
      modelKey: config.modelKey,
      outputUrl,
      rawResponse,
      processingTimeMs: Date.now() - startedAt
    };
  })().catch((error: unknown) => {
    if (error instanceof ReplicateApiError) {
      throw toPhotoEnhancementError(error.message, startedAt, error.status, error.responseJson ?? error.responseBody);
    }

    if (error instanceof ReplicatePredictionError) {
      rawResponse = error.prediction;
      providerRequestId = providerRequestId ?? error.prediction.id;
    }

    throw toPhotoEnhancementError(
      error instanceof Error ? error.message : "Unknown photo enhancement error.",
      startedAt,
      null,
      rawResponse
    );
  });
}

function toPhotoEnhancementError(message: string, startedAt: number, statusCode?: number | null, rawResponse?: unknown) {
  return new PhotoEnhancementProviderError(message, {
    statusCode,
    rawResponse,
    processingTimeMs: Date.now() - startedAt
  });
}
