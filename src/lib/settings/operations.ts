import { unstable_cache } from "next/cache";
import { appConfig } from "@/config/app";
import { prisma } from "@/lib/db";

export const OPERATIONAL_SETTINGS_KEY = "site_operations";

export type OperationalSettings = {
  brandName: string;
  supportEmail: string;
  defaultCurrency: string;
  maintenanceMode: boolean;
  uploadsEnabled: boolean;
  cleanExportsEnabled: boolean;
  checkoutEnabled: boolean;
  previewEnabled: boolean;
  registrationEnabled: boolean;
  emailsEnabled: boolean;
  billingEmail: string;
  uploadMaxSizeMb: number;
  guestPreviewPerMinute: number;
  guestPreviewPerHour: number;
  userJobsPerMinute: number;
  userJobsPerDay: number;
  estimatedCreditUsdValue: number;
};

export const defaultOperationalSettings: OperationalSettings = {
  brandName: appConfig.name,
  supportEmail: appConfig.supportEmail,
  defaultCurrency: "USD",
  maintenanceMode: false,
  uploadsEnabled: true,
  cleanExportsEnabled: true,
  checkoutEnabled: true,
  previewEnabled: true,
  registrationEnabled: true,
  emailsEnabled: false,
  billingEmail: appConfig.supportEmail,
  uploadMaxSizeMb: 10,
  guestPreviewPerMinute: 3,
  guestPreviewPerHour: 15,
  userJobsPerMinute: 10,
  userJobsPerDay: 100,
  estimatedCreditUsdValue: 0.7
};

export async function getOperationalSettings({ bypassCache = false } = {}) {
  if (bypassCache) return readOperationalSettings();
  return cachedOperationalSettings();
}

const cachedOperationalSettings = unstable_cache(readOperationalSettings, ["site-operations"], {
  revalidate: 60,
  tags: ["site-operations"]
});

async function readOperationalSettings(): Promise<OperationalSettings> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: OPERATIONAL_SETTINGS_KEY },
      select: { valueJson: true }
    });
    return normalizeOperationalSettings(setting?.valueJson);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[operations-settings-fallback]", error instanceof Error ? error.message : error);
    }
    return defaultOperationalSettings;
  }
}

export function normalizeOperationalSettings(value: unknown): OperationalSettings {
  if (!value || typeof value !== "object") return defaultOperationalSettings;
  const raw = value as Partial<Record<keyof OperationalSettings, unknown>>;
  return {
    brandName: normalizeString(raw.brandName, defaultOperationalSettings.brandName, 80),
    supportEmail: normalizeString(raw.supportEmail, defaultOperationalSettings.supportEmail, 160),
    defaultCurrency: normalizeString(raw.defaultCurrency, defaultOperationalSettings.defaultCurrency, 8).toUpperCase(),
    maintenanceMode: Boolean(raw.maintenanceMode),
    uploadsEnabled: raw.uploadsEnabled === undefined ? true : Boolean(raw.uploadsEnabled),
    cleanExportsEnabled: raw.cleanExportsEnabled === undefined ? true : Boolean(raw.cleanExportsEnabled),
    checkoutEnabled: raw.checkoutEnabled === undefined ? true : Boolean(raw.checkoutEnabled),
    previewEnabled: raw.previewEnabled === undefined ? true : Boolean(raw.previewEnabled),
    registrationEnabled: raw.registrationEnabled === undefined ? true : Boolean(raw.registrationEnabled),
    emailsEnabled: raw.emailsEnabled === undefined ? false : Boolean(raw.emailsEnabled),
    billingEmail: normalizeString(raw.billingEmail, defaultOperationalSettings.billingEmail, 160),
    uploadMaxSizeMb: normalizeNumber(raw.uploadMaxSizeMb, defaultOperationalSettings.uploadMaxSizeMb),
    guestPreviewPerMinute: normalizeNumber(raw.guestPreviewPerMinute, defaultOperationalSettings.guestPreviewPerMinute),
    guestPreviewPerHour: normalizeNumber(raw.guestPreviewPerHour, defaultOperationalSettings.guestPreviewPerHour),
    userJobsPerMinute: normalizeNumber(raw.userJobsPerMinute, defaultOperationalSettings.userJobsPerMinute),
    userJobsPerDay: normalizeNumber(raw.userJobsPerDay, defaultOperationalSettings.userJobsPerDay),
    estimatedCreditUsdValue: normalizeDecimal(raw.estimatedCreditUsdValue, defaultOperationalSettings.estimatedCreditUsdValue)
  };
}

export function toOperationalSettingsJson(settings: OperationalSettings) {
  return {
    brandName: settings.brandName,
    supportEmail: settings.supportEmail,
    defaultCurrency: settings.defaultCurrency,
    maintenanceMode: settings.maintenanceMode,
    uploadsEnabled: settings.uploadsEnabled,
    cleanExportsEnabled: settings.cleanExportsEnabled,
    checkoutEnabled: settings.checkoutEnabled,
    previewEnabled: settings.previewEnabled,
    registrationEnabled: settings.registrationEnabled,
    emailsEnabled: settings.emailsEnabled,
    billingEmail: settings.billingEmail,
    uploadMaxSizeMb: settings.uploadMaxSizeMb,
    guestPreviewPerMinute: settings.guestPreviewPerMinute,
    guestPreviewPerHour: settings.guestPreviewPerHour,
    userJobsPerMinute: settings.userJobsPerMinute,
    userJobsPerDay: settings.userJobsPerDay,
    estimatedCreditUsdValue: settings.estimatedCreditUsdValue
  };
}

function normalizeString(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || fallback;
}

function normalizeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function normalizeDecimal(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed * 10000) / 10000;
}
