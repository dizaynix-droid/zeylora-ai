import type { AiProvider, AiProviderKey } from "./types";

const providers = new Map<AiProviderKey, AiProvider>();

export function registerProvider(provider: AiProvider) {
  providers.set(provider.key, provider);
}

export function getProvider(key: AiProviderKey) {
  const provider = providers.get(key);

  if (!provider) {
    throw new Error(`AI provider is not registered: ${key}`);
  }

  return provider;
}

export function listRegisteredProviders() {
  return Array.from(providers.values());
}
