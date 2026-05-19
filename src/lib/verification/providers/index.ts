import type { VerificationProvider } from "@/lib/verification/types";
import { createMillionVerifierProvider } from "@/lib/verification/providers/millionverifier";

export type VerificationProviderOptions = {
  apiKey?: string | null;
  baseUrl?: string | null;
};

export function getVerificationProvider(providerKey = "millionverifier", options: VerificationProviderOptions = {}): VerificationProvider {
  if (providerKey === "millionverifier") {
    return createMillionVerifierProvider(options);
  }

  throw new Error(`Unsupported verification provider: ${providerKey}`);
}
