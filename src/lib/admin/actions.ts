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
  const credits = Number(formData.get("credits") || 0);
  const price = Number(formData.get("price") || 0);
  const status = String(formData.get("status") || "ACTIVE");

  if (!packageId || !Number.isInteger(credits) || credits <= 0 || !Number.isFinite(price) || price <= 0) {
    throw new Error("Invalid credit package.");
  }

  if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
    throw new Error("Invalid package status.");
  }

  await prisma.creditPackage.update({
    where: { id: packageId },
    data: {
      credits,
      price,
      status: status as "ACTIVE" | "INACTIVE" | "SUSPENDED"
    }
  });

  await logAdminAction({
    admin,
    action: "pricing.update_pack",
    entityType: "CreditPackage",
    entityId: packageId,
    metadata: { credits, price, status }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
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

function getFormString(formData: FormData, key: string, maxLength = 240) {
  return String(formData.get(key) || "").trim().slice(0, maxLength);
}
