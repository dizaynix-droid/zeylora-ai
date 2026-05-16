import { objectRemoverConfig, type ObjectRemovalQualityMode } from "@/config/ai-tools";
import {
  createReplicatePrediction,
  extractReplicateOutputUrl,
  ReplicateApiError,
  ReplicatePredictionError,
  waitForReplicatePrediction
} from "@/lib/ai/providers/replicate";

export type ObjectRemovalResult = {
  providerKey: "replicate";
  providerRequestId: string;
  model: string;
  modelKey: string;
  outputUrl: string;
  rawResponse: unknown;
  processingTimeMs: number;
  qualityMode: ObjectRemovalQualityMode;
  prompt: string;
};

export class ObjectRemovalProviderError extends Error {
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
    this.name = "ObjectRemovalProviderError";
    this.providerKey = "replicate";
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
}): Promise<ObjectRemovalResult> {
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

function toObjectRemovalError(message: string, startedAt: number, statusCode?: number | null, rawResponse?: unknown) {
  return new ObjectRemovalProviderError(message, {
    statusCode,
    rawResponse,
    processingTimeMs: Date.now() - startedAt
  });
}
