import { getProvider } from "./provider-registry";
import type { CreateAiJobInput, ProviderCreateResult } from "./types";

export type FallbackAttempt = {
  providerKey: string;
  ok: boolean;
  errorMessage?: string;
};

export async function createJobWithFallback(input: CreateAiJobInput): Promise<{
  result: ProviderCreateResult;
  providerKey: string;
  attempts: FallbackAttempt[];
}> {
  const providerKeys = [
    input.tool.providerKey,
    ...(input.tool.retryPolicy.allowFallback ? input.tool.fallbackProviderKeys : [])
  ];
  const attempts: FallbackAttempt[] = [];

  for (const providerKey of providerKeys) {
    try {
      const provider = getProvider(providerKey);
      const result = await provider.createJob(input);
      attempts.push({ providerKey, ok: true });
      return { result, providerKey, attempts };
    } catch (error) {
      attempts.push({
        providerKey,
        ok: false,
        errorMessage: error instanceof Error ? error.message : "Unknown provider error"
      });
    }
  }

  throw new Error("All configured AI providers failed.");
}
