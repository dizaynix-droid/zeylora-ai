import {
  aiAdCreativeConfig,
  aiBackgroundReplacerConfig,
  type GenerativeQualityMode
} from "@/config/ai-tools";
import {
  createReplicatePrediction,
  extractReplicateOutputUrl,
  ReplicateApiError,
  ReplicatePredictionError,
  waitForReplicatePrediction
} from "@/lib/ai/providers/replicate";

export type EcommerceGenerationTool = "ai-background-replacer" | "ai-ad-creative-generator";

export type EcommerceGenerationResult = {
  providerKey: "replicate";
  providerRequestId: string;
  model: string;
  modelKey: string;
  outputUrl: string;
  rawResponse: unknown;
  processingTimeMs: number;
  qualityMode: GenerativeQualityMode;
  prompt: string;
};

export class EcommerceGenerationProviderError extends Error {
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
    this.name = "EcommerceGenerationProviderError";
    this.providerKey = "replicate";
    this.statusCode = input.statusCode;
    this.rawResponse = input.rawResponse;
    this.processingTimeMs = input.processingTimeMs;
  }
}

export async function runEcommerceGeneration(input: {
  toolKey: EcommerceGenerationTool;
  imageUrl: string;
  prompt: string;
  qualityMode: GenerativeQualityMode;
  aspectRatio?: string;
  modelOverride?: string | null;
}): Promise<EcommerceGenerationResult> {
  const startedAt = Date.now();
  const config = input.toolKey === "ai-background-replacer" ? aiBackgroundReplacerConfig : aiAdCreativeConfig;
  const model = input.modelOverride || (input.qualityMode === "pro" ? config.proModel : config.model);
  let providerRequestId: string | undefined;
  let rawResponse: unknown;

  return (async () => {
    const prediction = await createReplicatePrediction({
      model,
      imageUrl: input.imageUrl,
      input: createGenerativeInput({
        imageUrl: input.imageUrl,
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        toolKey: input.toolKey
      })
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
      throw new Error("Replicate ecommerce generation output URL is missing.");
    }

    return {
      providerKey: "replicate" as const,
      providerRequestId,
      model,
      modelKey: `replicate-${input.toolKey}:${input.qualityMode}`,
      outputUrl,
      rawResponse,
      processingTimeMs: Date.now() - startedAt,
      qualityMode: input.qualityMode,
      prompt: input.prompt
    };
  })().catch((error: unknown) => {
    if (error instanceof ReplicateApiError) {
      throw toGenerationError(error.message, startedAt, error.status, error.responseJson ?? error.responseBody);
    }

    if (error instanceof ReplicatePredictionError) {
      rawResponse = error.prediction;
      providerRequestId = providerRequestId ?? error.prediction.id;
    }

    throw toGenerationError(
      error instanceof Error ? error.message : "Unknown ecommerce generation error.",
      startedAt,
      null,
      rawResponse
    );
  });
}

function createGenerativeInput(input: {
  imageUrl: string;
  prompt: string;
  aspectRatio?: string;
  toolKey: EcommerceGenerationTool;
}) {
  return {
    prompt: input.prompt,
    input_image: input.imageUrl,
    aspect_ratio: input.aspectRatio,
    output_format: "png",
    safety_tolerance: 2,
    prompt_upsampling: input.toolKey === "ai-ad-creative-generator"
  };
}

function toGenerationError(message: string, startedAt: number, statusCode?: number | null, rawResponse?: unknown) {
  return new EcommerceGenerationProviderError(message, {
    statusCode,
    rawResponse,
    processingTimeMs: Date.now() - startedAt
  });
}
