import type { VerificationProvider } from "@/lib/verification/types";
import { createMillionVerifierProvider } from "@/lib/verification/providers/millionverifier";

export function getVerificationProvider(providerKey = "millionverifier"): VerificationProvider {
  if (providerKey === "millionverifier") {
    return createMillionVerifierProvider();
  }

  throw new Error(`Unsupported verification provider: ${providerKey}`);
}
