"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { deleteDashboardCache } from "@/lib/dashboard/cache";
import {
  clearMarketingTrackingSettingsCache,
  MARKETING_TRACKING_SETTING_KEY,
  toMarketingTrackingJson,
  type MarketingTrackingSettings
} from "@/lib/settings/marketing";
import {
  OPERATIONAL_SETTINGS_KEY,
  toOperationalSettingsJson,
  type OperationalSettings
} from "@/lib/settings/operations";

export async function adjustUserCreditsAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const rawAmount = Number(formData.get("amount") || 0);
  const note = String(formData.get("note") || "Admin credit adjustment").trim();

  if (!userId || !Number.isInteger(rawAmount) || rawAmount === 0) {
    throw new Error("Invalid credit adjustment.");
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true }
    });

    if (!user) {
      throw new Error("User not found.");
    }

    const balanceAfter = user.creditBalance + rawAmount;

    await tx.user.update({
      where: { id: userId },
      data: { creditBalance: balanceAfter }
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: "ADMIN_ADJUSTMENT",
        amount: rawAmount,
        balanceAfter,
        note
      }
    });
  });

  deleteDashboardCache(`dashboard:credits:${userId}`);
  deleteDashboardCache(`dashboard:transactions:${userId}`);
  await logAdminAction({
    admin,
    action: "credit.adjust",
    entityType: "User",
    entityId: userId,
    metadata: { amount: rawAmount, note }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/credits");
  revalidatePath("/dashboard");
}

export async function updateToolEconomicsAction(formData: FormData) {
  const admin = await requireAdmin();
  const toolId = String(formData.get("toolId") || "");
  const creditCost = Number(formData.get("creditCost") || 0);
  const status = String(formData.get("status") || "ACTIVE");

  if (!toolId || !Number.isInteger(creditCost) || creditCost < 0) {
    throw new Error("Invalid tool configuration.");
  }

  if (!["DRAFT", "ACTIVE", "INACTIVE", "PAUSED"].includes(status)) {
    throw new Error("Invalid tool status.");
  }

  await prisma.aiTool.update({
    where: { id: toolId },
    data: {
      creditCost,
      status: status as "DRAFT" | "ACTIVE" | "INACTIVE" | "PAUSED"
    }
  });

  await logAdminAction({
    admin,
    action: "tool.update_economics",
    entityType: "AiTool",
    entityId: toolId,
    metadata: { creditCost, status }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/tools");
}

export async function updateCreditPackageAction(formData: FormData) {
  const admin = await requireAdmin();
  const packageId = String(formData.get("packageId") || "");
  const name = getFormString(formData, "name", 80);
  const credits = Number(formData.get("credits") || 0);
  const price = Number(formData.get("price") || 0);
  const sortOrder = Number(formData.get("sortOrder") || 0);
  const stripePriceId = getFormString(formData, "stripePriceId", 240);
  const featureFlagKey = getFormString(formData, "featureFlagKey", 120);
  const status = String(formData.get("status") || "ACTIVE");

  if (
    !packageId ||
    !name ||
    !Number.isInteger(credits) ||
    credits <= 0 ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isInteger(sortOrder)
  ) {
    throw new Error("Invalid credit package.");
  }

  if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
    throw new Error("Invalid package status.");
  }

  await prisma.creditPackage.update({
    where: { id: packageId },
    data: {
      name,
      credits,
      price,
      sortOrder,
      stripePriceId: stripePriceId || null,
      featureFlagKey: featureFlagKey || null,
      status: status as "ACTIVE" | "INACTIVE" | "SUSPENDED"
    }
  });

  await logAdminAction({
    admin,
    action: "pricing.update_pack",
    entityType: "CreditPackage",
    entityId: packageId,
    metadata: { name, credits, price, sortOrder, stripePriceId: Boolean(stripePriceId), featureFlagKey, status }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
}

export async function syncLaunchCreditPackagesAction() {
  const admin = await requireAdmin();
  const { creditPackages } = await import("@/config/pricing");

  await prisma.$transaction(async (tx) => {
    for (const [index, pack] of creditPackages.entries()) {
      const existing = await tx.creditPackage.findFirst({
        where: { name: pack.name, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true }
      });
      const data = {
        credits: pack.credits + pack.bonusCredits,
        price: pack.price,
        currency: pack.currency.toLowerCase(),
        sortOrder: index + 1,
        featureFlagKey: pack.featureFlagKey,
        status: "ACTIVE" as const
      };

      if (existing) {
        await tx.creditPackage.update({
          where: { id: existing.id },
          data
        });
      } else {
        await tx.creditPackage.create({
          data: {
            name: pack.name,
            ...data
          }
        });
      }
    }
  });

  await logAdminAction({
    admin,
    action: "pricing.sync_launch_packs",
    entityType: "CreditPackage",
    metadata: { count: creditPackages.length }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
}

export async function upsertCmsPageAction(formData: FormData) {
  const admin = await requireAdmin();
  const pageId = getFormString(formData, "pageId", 120);
  const slug = normalizeSlug(getFormString(formData, "slug", 120));
  const title = getFormString(formData, "title", 160);
  const metaTitle = getFormString(formData, "metaTitle", 180);
  const metaDescription = getFormString(formData, "metaDescription", 280);
  const bodyMarkdown = getFormString(formData, "bodyMarkdown", 20000);
  const status = getFormString(formData, "status", 20);

  if (!slug || !title || !metaTitle || !metaDescription || !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
    throw new Error("Invalid CMS page.");
  }

  const contentJson = {
    bodyMarkdown: stripDangerousCmsContent(bodyMarkdown)
  };

  const page = pageId
    ? await prisma.page.update({
        where: { id: pageId },
        data: {
          slug,
          title,
          metaTitle,
          metaDescription,
          contentJson,
          status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED"
        },
        select: { id: true, slug: true }
      })
    : await prisma.page.upsert({
        where: {
          slug_language: {
            slug,
            language: "en"
          }
        },
        update: {
          title,
          metaTitle,
          metaDescription,
          contentJson,
          status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
          deletedAt: null
        },
        create: {
          slug,
          title,
          metaTitle,
          metaDescription,
          contentJson,
          language: "en",
          status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED"
        },
        select: { id: true, slug: true }
      });

  await logAdminAction({
    admin,
    action: "cms.page.upsert",
    entityType: "Page",
    entityId: page.id,
    metadata: { slug: page.slug, status }
  });

  revalidatePath("/admin/cms");
  revalidatePath(`/${page.slug}`);
  revalidatePath("/", "layout");
}

export async function updateMarketingTrackingSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  const settings: MarketingTrackingSettings = {
    ga4MeasurementId: getFormString(formData, "ga4MeasurementId"),
    googleAdsConversionId: getFormString(formData, "googleAdsConversionId"),
    googleAdsConversionLabel: getFormString(formData, "googleAdsConversionLabel"),
    metaPixelId: getFormString(formData, "metaPixelId"),
    tiktokPixelId: getFormString(formData, "tiktokPixelId"),
    pinterestTagId: getFormString(formData, "pinterestTagId"),
    googleSearchConsoleVerification: getFormString(formData, "googleSearchConsoleVerification"),
    bingWebmasterVerification: getFormString(formData, "bingWebmasterVerification"),
    facebookDomainVerification: getFormString(formData, "facebookDomainVerification"),
    customHeadScript: getFormString(formData, "customHeadScript", 8000),
    customBodyScript: getFormString(formData, "customBodyScript", 8000),
    customScriptsEnabled: formData.get("customScriptsEnabled") === "on"
  };

  await prisma.siteSetting.upsert({
    where: { key: MARKETING_TRACKING_SETTING_KEY },
    update: { valueJson: toMarketingTrackingJson(settings) },
    create: {
      key: MARKETING_TRACKING_SETTING_KEY,
      valueJson: toMarketingTrackingJson(settings)
    }
  });

  clearMarketingTrackingSettingsCache();
  await logAdminAction({
    admin,
    action: "settings.marketing_tracking.update",
    entityType: "SiteSetting",
    entityId: MARKETING_TRACKING_SETTING_KEY,
    metadata: {
      ga4: Boolean(settings.ga4MeasurementId),
      googleAds: Boolean(settings.googleAdsConversionId),
      metaPixel: Boolean(settings.metaPixelId),
      tiktok: Boolean(settings.tiktokPixelId),
      pinterest: Boolean(settings.pinterestTagId),
      verificationTags: [
        settings.googleSearchConsoleVerification ? "google" : null,
        settings.bingWebmasterVerification ? "bing" : null,
        settings.facebookDomainVerification ? "facebook" : null
      ].filter(Boolean),
      customScriptsEnabled: settings.customScriptsEnabled
    }
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
}

export async function updateOperationalSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  const settings: OperationalSettings = {
    brandName: getFormString(formData, "brandName", 80),
    supportEmail: getFormString(formData, "supportEmail", 160),
    defaultCurrency: getFormString(formData, "defaultCurrency", 8).toUpperCase() || "USD",
    maintenanceMode: formData.get("maintenanceMode") === "on",
    cleanExportsEnabled: formData.get("cleanExportsEnabled") === "on",
    checkoutEnabled: formData.get("checkoutEnabled") === "on"
  };

  await prisma.siteSetting.upsert({
    where: { key: OPERATIONAL_SETTINGS_KEY },
    update: { valueJson: toOperationalSettingsJson(settings) },
    create: {
      key: OPERATIONAL_SETTINGS_KEY,
      valueJson: toOperationalSettingsJson(settings)
    }
  });

  await logAdminAction({
    admin,
    action: "settings.operations.update",
    entityType: "SiteSetting",
    entityId: OPERATIONAL_SETTINGS_KEY,
    metadata: {
      brandName: settings.brandName,
      supportEmail: settings.supportEmail,
      defaultCurrency: settings.defaultCurrency,
      maintenanceMode: settings.maintenanceMode,
      cleanExportsEnabled: settings.cleanExportsEnabled,
      checkoutEnabled: settings.checkoutEnabled
    }
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
}

function getFormString(formData: FormData, key: string, maxLength = 240) {
  return String(formData.get(key) || "").trim().slice(0, maxLength);
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/(^-|-$)/g, "");
}

function stripDangerousCmsContent(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .trim();
}
