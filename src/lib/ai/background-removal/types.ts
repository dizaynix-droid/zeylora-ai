import type {
  BackgroundRemovalAttempt,
  BackgroundRemovalProviderKey,
  BackgroundRemovalQualityMode
} from "@/config/ai-tools";

export type BackgroundRemovalTarget =
  | {
      providerKey: "replicate";
      key: string;
      label: string;
      attempt: BackgroundRemovalAttempt;
    }
  | {
      providerKey: "photoroom" | "removebg";
      key: string;
      label: string;
      qualityTier: BackgroundRemovalQualityMode;
    };

export type BackgroundRemovalProviderInput = {
  imageUrl: string;
  imageBuffer?: Buffer;
  mimeType?: string;
  filename?: string;
  target: BackgroundRemovalTarget;
};

export type BackgroundRemovalProviderResult = {
  providerKey: BackgroundRemovalProviderKey;
  targetKey: string;
  label: string;
  providerRequestId?: string;
  model?: string;
  qualityTier: BackgroundRemovalQualityMode;
  outputBuffer: Buffer;
  contentType: string;
  rawResponse?: unknown;
  processingTimeMs: number;
};

export class BackgroundRemovalProviderError extends Error {
  providerKey: BackgroundRemovalProviderKey;
  targetKey: string;
  statusCode?: number | null;
  rawResponse?: unknown;
  processingTimeMs: number;

  constructor(message: string, input: {
    providerKey: BackgroundRemovalProviderKey;
    targetKey: string;
    statusCode?: number | null;
    rawResponse?: unknown;
    processingTimeMs: number;
  }) {
    super(message);
    this.name = "BackgroundRemovalProviderError";
    this.providerKey = input.providerKey;
    this.targetKey = input.targetKey;
    this.statusCode = input.statusCode;
    this.rawResponse = input.rawResponse;
    this.processingTimeMs = input.processingTimeMs;
  }
}
