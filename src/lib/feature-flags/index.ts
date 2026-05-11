export type FeatureFlagContext = {
  userId?: string;
  locale?: string;
  country?: string;
  path?: string;
};

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  rules?: Record<string, unknown> | null;
};

const defaultFlags: Record<string, FeatureFlag> = {
  upload_flow: { key: "upload_flow", enabled: true },
  credit_checkout: { key: "credit_checkout", enabled: false },
  blog: { key: "blog", enabled: true },
  admin_experiments: { key: "admin_experiments", enabled: false }
};

export function isFeatureEnabled(key: string, context?: FeatureFlagContext) {
  void context;
  return defaultFlags[key]?.enabled ?? false;
}

export function getDefaultFeatureFlags() {
  return Object.values(defaultFlags);
}
