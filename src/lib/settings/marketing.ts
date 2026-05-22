import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const MARKETING_TRACKING_SETTING_KEY = "marketing_tracking";
export const MARKETING_TRACKING_CACHE_TAG = "marketing-tracking-settings";

export type MarketingTrackingSettings = {
  ga4MeasurementId: string;
  googleAdsConversionId: string;
  googleAdsConversionLabel: string;
  metaPixelId: string;
  tiktokPixelId: string;
  pinterestTagId: string;
  googleSearchConsoleVerification: string;
  bingWebmasterVerification: string;
  facebookDomainVerification: string;
  customHeadScript: string;
  customBodyScript: string;
  customScriptsEnabled: boolean;
};

const emptyMarketingTrackingSettings: MarketingTrackingSettings = {
  ga4MeasurementId: "",
  googleAdsConversionId: "",
  googleAdsConversionLabel: "",
  metaPixelId: "",
  tiktokPixelId: "",
  pinterestTagId: "",
  googleSearchConsoleVerification: "",
  bingWebmasterVerification: "",
  facebookDomainVerification: "",
  customHeadScript: "",
  customBodyScript: "",
  customScriptsEnabled: false
};

let cachedSettings: { expiresAt: number; value: MarketingTrackingSettings } | null = null;
let cachedSettingsPromise: Promise<MarketingTrackingSettings> | null = null;
const SETTINGS_CACHE_MS = 5 * 60_000;

const getCachedMarketingTrackingSettings = unstable_cache(
  async () => readMarketingTrackingSettings(),
  ["marketing-tracking-settings-v1"],
  {
    revalidate: 300,
    tags: [MARKETING_TRACKING_CACHE_TAG]
  }
);

export async function getMarketingTrackingSettings(options: { bypassCache?: boolean } = {}) {
  if (!options.bypassCache && cachedSettings && cachedSettings.expiresAt > Date.now()) {
    return cachedSettings.value;
  }

  if (!options.bypassCache && cachedSettingsPromise) {
    return cachedSettingsPromise;
  }

  cachedSettingsPromise = options.bypassCache ? readMarketingTrackingSettings() : getCachedMarketingTrackingSettings();
  try {
    return await cachedSettingsPromise;
  } finally {
    cachedSettingsPromise = null;
  }
}

async function readMarketingTrackingSettings() {
  if (!process.env.DATABASE_URL) {
    return emptyMarketingTrackingSettings;
  }

  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: MARKETING_TRACKING_SETTING_KEY },
      select: { valueJson: true }
    });
    const value = normalizeMarketingTrackingSettings(setting?.valueJson);
    cachedSettings = {
      expiresAt: Date.now() + SETTINGS_CACHE_MS,
      value
    };
    return value;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[marketing-settings-fallback]", error instanceof Error ? error.message : error);
    }
    return emptyMarketingTrackingSettings;
  }
}

export function normalizeMarketingTrackingSettings(value: unknown): MarketingTrackingSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyMarketingTrackingSettings;
  }

  const record = value as Record<string, unknown>;

  return {
    ga4MeasurementId: sanitizePublicId(record.ga4MeasurementId),
    googleAdsConversionId: sanitizePublicId(record.googleAdsConversionId),
    googleAdsConversionLabel: sanitizePublicId(record.googleAdsConversionLabel),
    metaPixelId: sanitizePublicId(record.metaPixelId),
    tiktokPixelId: sanitizePublicId(record.tiktokPixelId),
    pinterestTagId: sanitizePublicId(record.pinterestTagId),
    googleSearchConsoleVerification: sanitizeVerificationContent(record.googleSearchConsoleVerification),
    bingWebmasterVerification: sanitizeVerificationContent(record.bingWebmasterVerification),
    facebookDomainVerification: sanitizeVerificationContent(record.facebookDomainVerification),
    customHeadScript: sanitizeCustomScript(record.customHeadScript),
    customBodyScript: sanitizeCustomScript(record.customBodyScript),
    customScriptsEnabled: record.customScriptsEnabled === true
  };
}

export function toMarketingTrackingJson(settings: MarketingTrackingSettings): Prisma.InputJsonObject {
  return {
    ...settings
  };
}

export function clearMarketingTrackingSettingsCache() {
  cachedSettings = null;
  cachedSettingsPromise = null;
}

function sanitizePublicId(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[<>"']/g, "").slice(0, 120);
}

function sanitizeVerificationContent(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[<>"]/g, "").slice(0, 240);
}

function sanitizeCustomScript(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 8000);
}
