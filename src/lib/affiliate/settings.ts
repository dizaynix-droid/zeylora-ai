import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const AFFILIATE_SETTINGS_KEY = "affiliate_program";

export type AffiliateTierConfig = {
  key: "starter" | "growth" | "elite";
  name: string;
  rewardPercent: number;
  requiredPaidReferrals: number;
  requiredReferredRevenue: number;
  monthlyCapCredits: number;
  active: boolean;
};

export type AffiliateSettings = {
  enabled: boolean;
  defaultRewardPercent: number;
  minimumPaymentAmount: number;
  rewardCurrencyMode: "credits_only";
  rewardDelayDays: number;
  maxRewardCreditsPerPayment: number;
  maxMonthlyRewardCreditsPerAffiliate: number;
  rewardScope: "FIRST_PAYMENT_ONLY" | "ALL_PAYMENTS";
  estimatedCreditUsdValue: number;
  tiers: AffiliateTierConfig[];
};

export const defaultAffiliateSettings: AffiliateSettings = {
  enabled: true,
  defaultRewardPercent: 20,
  minimumPaymentAmount: 7.99,
  rewardCurrencyMode: "credits_only",
  rewardDelayDays: 0,
  maxRewardCreditsPerPayment: 500,
  maxMonthlyRewardCreditsPerAffiliate: 5000,
  rewardScope: "ALL_PAYMENTS",
  estimatedCreditUsdValue: 0.7,
  tiers: [
    {
      key: "starter",
      name: "Starter Partner",
      rewardPercent: 20,
      requiredPaidReferrals: 0,
      requiredReferredRevenue: 0,
      monthlyCapCredits: 5000,
      active: true
    },
    {
      key: "growth",
      name: "Growth Partner",
      rewardPercent: 25,
      requiredPaidReferrals: 25,
      requiredReferredRevenue: 1000,
      monthlyCapCredits: 10000,
      active: true
    },
    {
      key: "elite",
      name: "Elite Partner",
      rewardPercent: 30,
      requiredPaidReferrals: 75,
      requiredReferredRevenue: 5000,
      monthlyCapCredits: 25000,
      active: true
    }
  ]
};

export async function getAffiliateSettings({ bypassCache = false } = {}) {
  if (bypassCache) return readAffiliateSettings();
  return cachedAffiliateSettings();
}

export async function saveAffiliateSettings(settings: AffiliateSettings) {
  await prisma.siteSetting.upsert({
    where: { key: AFFILIATE_SETTINGS_KEY },
    update: { valueJson: toAffiliateSettingsJson(settings) },
    create: {
      key: AFFILIATE_SETTINGS_KEY,
      valueJson: toAffiliateSettingsJson(settings)
    }
  });
}

const cachedAffiliateSettings = unstable_cache(readAffiliateSettings, ["affiliate-settings"], {
  revalidate: 60,
  tags: ["affiliate-settings"]
});

async function readAffiliateSettings(): Promise<AffiliateSettings> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: AFFILIATE_SETTINGS_KEY },
      select: { valueJson: true }
    });

    return normalizeAffiliateSettings(setting?.valueJson);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[affiliate-settings-fallback]", error instanceof Error ? error.message : error);
    }
    return defaultAffiliateSettings;
  }
}

export function normalizeAffiliateSettings(value: unknown): AffiliateSettings {
  if (!value || typeof value !== "object") return defaultAffiliateSettings;
  const raw = value as Record<string, unknown>;

  return {
    enabled: raw.enabled === undefined ? defaultAffiliateSettings.enabled : Boolean(raw.enabled),
    defaultRewardPercent: normalizePercent(raw.defaultRewardPercent, defaultAffiliateSettings.defaultRewardPercent),
    minimumPaymentAmount: normalizeMoney(raw.minimumPaymentAmount, defaultAffiliateSettings.minimumPaymentAmount),
    rewardCurrencyMode: "credits_only",
    rewardDelayDays: normalizeInteger(raw.rewardDelayDays, defaultAffiliateSettings.rewardDelayDays),
    maxRewardCreditsPerPayment: normalizeInteger(raw.maxRewardCreditsPerPayment, defaultAffiliateSettings.maxRewardCreditsPerPayment),
    maxMonthlyRewardCreditsPerAffiliate: normalizeInteger(
      raw.maxMonthlyRewardCreditsPerAffiliate,
      defaultAffiliateSettings.maxMonthlyRewardCreditsPerAffiliate
    ),
    rewardScope: raw.rewardScope === "FIRST_PAYMENT_ONLY" ? "FIRST_PAYMENT_ONLY" : "ALL_PAYMENTS",
    estimatedCreditUsdValue: normalizeMoney(raw.estimatedCreditUsdValue, defaultAffiliateSettings.estimatedCreditUsdValue),
    tiers: normalizeTiers(raw.tiers)
  };
}

export function toAffiliateSettingsJson(settings: AffiliateSettings) {
  return {
    enabled: settings.enabled,
    defaultRewardPercent: settings.defaultRewardPercent,
    minimumPaymentAmount: settings.minimumPaymentAmount,
    rewardCurrencyMode: "credits_only",
    rewardDelayDays: settings.rewardDelayDays,
    maxRewardCreditsPerPayment: settings.maxRewardCreditsPerPayment,
    maxMonthlyRewardCreditsPerAffiliate: settings.maxMonthlyRewardCreditsPerAffiliate,
    rewardScope: settings.rewardScope,
    estimatedCreditUsdValue: settings.estimatedCreditUsdValue,
    tiers: settings.tiers
  };
}

export function resolveAffiliateTier(settings: AffiliateSettings, input: { paidReferrals: number; referredRevenue: number; tierKey?: string | null }) {
  const activeTiers = settings.tiers.filter((tier) => tier.active);
  const explicitTier = activeTiers.find((tier) => tier.key === input.tierKey);

  const earnedTier = [...activeTiers]
    .sort((a, b) => b.requiredReferredRevenue - a.requiredReferredRevenue || b.requiredPaidReferrals - a.requiredPaidReferrals)
    .find((tier) => input.paidReferrals >= tier.requiredPaidReferrals && input.referredRevenue >= tier.requiredReferredRevenue) ?? settings.tiers[0];

  if (!explicitTier) return earnedTier;

  const explicitRank = activeTiers.findIndex((tier) => tier.key === explicitTier.key);
  const earnedRank = activeTiers.findIndex((tier) => tier.key === earnedTier.key);
  return explicitRank > earnedRank ? explicitTier : earnedTier;
}

function normalizeTiers(value: unknown): AffiliateTierConfig[] {
  const defaultsByKey = new Map(defaultAffiliateSettings.tiers.map((tier) => [tier.key, tier]));
  const rawTiers = Array.isArray(value) ? value : [];

  return defaultAffiliateSettings.tiers.map((defaultTier) => {
    const raw = rawTiers.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).key === defaultTier.key) as
      | Record<string, unknown>
      | undefined;
    const fallback = defaultsByKey.get(defaultTier.key) ?? defaultTier;

    return {
      key: defaultTier.key,
      name: normalizeString(raw?.name, fallback.name, 80),
      rewardPercent: normalizePercent(raw?.rewardPercent, fallback.rewardPercent),
      requiredPaidReferrals: normalizeInteger(raw?.requiredPaidReferrals, fallback.requiredPaidReferrals),
      requiredReferredRevenue: normalizeMoney(raw?.requiredReferredRevenue, fallback.requiredReferredRevenue),
      monthlyCapCredits: normalizeInteger(raw?.monthlyCapCredits, fallback.monthlyCapCredits),
      active: raw?.active === undefined ? fallback.active : Boolean(raw.active)
    };
  });
}

function normalizeString(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength) || fallback;
}

function normalizePercent(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return fallback;
  return Math.round(parsed * 100) / 100;
}

function normalizeMoney(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed * 10000) / 10000;
}

function normalizeInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}
