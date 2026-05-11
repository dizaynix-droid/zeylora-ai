export type AiProviderKey = "replicate" | "openai" | "stability" | "clipdrop";

export type AiToolRuntimeConfig = {
  slug: string;
  version: number;
  providerKey: AiProviderKey;
  fallbackProviderKeys: AiProviderKey[];
  creditCost: number;
  providerConfig: Record<string, unknown>;
  retryPolicy: {
    maxRetries: number;
    timeoutSeconds: number;
    retryDelaySeconds: number;
    allowFallback: boolean;
  };
};

export type CreateAiJobInput = {
  tool: AiToolRuntimeConfig;
  inputImageUrl: string;
  userId?: string;
  config?: Record<string, unknown>;
};

export type ProviderCreateResult = {
  providerRequestId: string;
  estimatedCost?: number;
};

export type ProviderJobStatus =
  | {
      status: "processing";
      rawResponse?: unknown;
    }
  | {
      status: "completed";
      outputUrl: string;
      rawResponse?: unknown;
    }
  | {
      status: "failed";
      errorMessage: string;
      rawResponse?: unknown;
    };

export interface AiProvider {
  key: AiProviderKey;
  createJob(input: CreateAiJobInput): Promise<ProviderCreateResult>;
  getJobStatus(providerRequestId: string): Promise<ProviderJobStatus>;
  cancelJob?(providerRequestId: string): Promise<void>;
}
