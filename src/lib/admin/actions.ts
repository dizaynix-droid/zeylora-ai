"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ExpenseCategory } from "@prisma/client";
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
  redirect("/admin/users?saved=credits");
}

export async function updateToolEconomicsAction(formData: FormData) {
  const admin = await requireAdmin();
  const toolId = String(formData.get("toolId") || "");
  const creditCost = Number(formData.get("creditCost") || 0);
  const status = String(formData.get("status") || "ACTIVE");
  const estimatedCostPerRun = Number(formData.get("estimatedCostPerRun") || 0);
  const estimatedCostCurrency = getFormString(formData, "estimatedCostCurrency", 8).toLowerCase() || "usd";
  const estimatedCostProvider = getFormString(formData, "estimatedCostProvider", 80);

  if (!toolId || !Number.isInteger(creditCost) || creditCost < 0 || !Number.isFinite(estimatedCostPerRun) || estimatedCostPerRun < 0) {
    throw new Error("Invalid tool configuration.");
  }

  if (!["DRAFT", "ACTIVE", "INACTIVE", "PAUSED"].includes(status)) {
    throw new Error("Invalid tool status.");
  }

  await prisma.aiTool.update({
    where: { id: toolId },
    data: {
      creditCost,
      status: status as "DRAFT" | "ACTIVE" | "INACTIVE" | "PAUSED",
      estimatedCostPerRun: estimatedCostPerRun > 0 ? estimatedCostPerRun : null,
      estimatedCostCurrency,
      estimatedCostProvider: estimatedCostProvider || null
    }
  });

  await logAdminAction({
    admin,
    action: "tool.update_economics",
    entityType: "AiTool",
    entityId: toolId,
    metadata: { creditCost, status, estimatedCostPerRun, estimatedCostCurrency, estimatedCostProvider }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/tools");
  revalidatePath("/admin/reports");
  redirect("/admin/tools?saved=tool");
}

export async function upsertBusinessExpenseAction(formData: FormData) {
  const admin = await requireAdmin();
  const expenseId = getFormString(formData, "expenseId", 120);
  const title = getFormString(formData, "title", 120);
  const category = getExpenseCategory(getFormString(formData, "category", 40));
  const amount = Number(formData.get("amount") || 0);
  const currency = getFormString(formData, "currency", 8).toLowerCase() || "usd";
  const expenseDateValue = getFormString(formData, "expenseDate", 40);
  const expenseDate = expenseDateValue ? new Date(`${expenseDateValue}T12:00:00`) : new Date();
  const note = getFormString(formData, "note", 500);

  if (!title || !category || !Number.isFinite(amount) || amount <= 0 || Number.isNaN(expenseDate.getTime())) {
    redirect("/admin/reports?error=expense");
  }

  const savedExpense = expenseId
    ? await prisma.businessExpense.update({
        where: { id: expenseId },
        data: {
          title,
          category,
          amount,
          currency,
          expenseDate,
          note: note || null,
          deletedAt: null
        },
        select: { id: true, title: true }
      })
    : await prisma.businessExpense.create({
        data: {
          title,
          category,
          amount,
          currency,
          expenseDate,
          note: note || null,
          createdByUserId: admin.source === "role" ? admin.id : null
        },
        select: { id: true, title: true }
      });

  await logAdminAction({
    admin,
    action: expenseId ? "expense.update" : "expense.create",
    entityType: "BusinessExpense",
    entityId: savedExpense.id,
    metadata: { title, category, amount, currency, expenseDate: expenseDate.toISOString() }
  });

  revalidatePath("/admin/reports");
  redirect(`/admin/reports?saved=${encodeURIComponent(savedExpense.title)}`);
}

export async function deleteBusinessExpenseAction(formData: FormData) {
  const admin = await requireAdmin();
  const expenseId = getFormString(formData, "expenseId", 120);

  if (!expenseId) {
    redirect("/admin/reports?error=expense");
  }

  const expense = await prisma.businessExpense.update({
    where: { id: expenseId },
    data: { deletedAt: new Date() },
    select: { id: true, title: true }
  });

  await logAdminAction({
    admin,
    action: "expense.delete",
    entityType: "BusinessExpense",
    entityId: expense.id,
    metadata: { title: expense.title, softDelete: true }
  });

  revalidatePath("/admin/reports");
  redirect(`/admin/reports?deleted=${encodeURIComponent(expense.title)}`);
}

export async function updateCreditPackageAction(formData: FormData) {
  const admin = await requireAdmin();
  const packageId = String(formData.get("packageId") || "");
  const name = getFormString(formData, "name", 80);
  const baseCredits = Number(formData.get("baseCredits") || 0);
  const bonusCredits = Number(formData.get("bonusCredits") || 0);
  const price = Number(formData.get("price") || 0);
  const sortOrder = Number(formData.get("sortOrder") || 0);
  const stripePriceId = getFormString(formData, "stripePriceId", 240);
  const featureFlagKey = getFormString(formData, "featureFlagKey", 120);
  const description = getFormString(formData, "description", 280);
  const audience = getFormString(formData, "audience", 180);
  const badgeText = getFormString(formData, "badgeText", 40);
  const highlight = formData.get("highlight") === "on";
  const status = String(formData.get("status") || "ACTIVE");

  if (
    !packageId ||
    !name ||
    !Number.isInteger(baseCredits) ||
    !Number.isInteger(bonusCredits) ||
    baseCredits <= 0 ||
    bonusCredits < 0 ||
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
      credits: baseCredits,
      bonusCredits,
      price,
      sortOrder,
      stripePriceId: stripePriceId || null,
      featureFlagKey: featureFlagKey || null,
      description: description || null,
      audience: audience || null,
      badgeText: badgeText || null,
      highlight,
      status: status as "ACTIVE" | "INACTIVE" | "SUSPENDED"
    }
  });

  await logAdminAction({
    admin,
    action: "pricing.update_pack",
    entityType: "CreditPackage",
    entityId: packageId,
    metadata: { name, baseCredits, bonusCredits, totalCredits: baseCredits + bonusCredits, price, sortOrder, stripePriceId: Boolean(stripePriceId), featureFlagKey, status }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
  revalidatePath("/");
  redirect(`/admin/pricing?saved=${encodeURIComponent(name)}`);
}

export async function createCreditPackageAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = getFormString(formData, "name", 80);
  const baseCredits = Number(formData.get("baseCredits") || 0);
  const bonusCredits = Number(formData.get("bonusCredits") || 0);
  const price = Number(formData.get("price") || 0);
  const sortOrder = Number(formData.get("sortOrder") || 99);
  const stripePriceId = getFormString(formData, "stripePriceId", 240);
  const featureFlagKey = getFormString(formData, "featureFlagKey", 120);
  const description = getFormString(formData, "description", 280);
  const audience = getFormString(formData, "audience", 180);
  const badgeText = getFormString(formData, "badgeText", 40);
  const highlight = formData.get("highlight") === "on";
  const status = String(formData.get("status") || "ACTIVE");

  if (
    !name ||
    !Number.isInteger(baseCredits) ||
    !Number.isInteger(bonusCredits) ||
    baseCredits <= 0 ||
    bonusCredits < 0 ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isInteger(sortOrder) ||
    !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)
  ) {
    redirect("/admin/pricing?error=invalid");
  }

  const pack = await prisma.creditPackage.create({
    data: {
      name,
      credits: baseCredits,
      bonusCredits,
      price,
      sortOrder,
      stripePriceId: stripePriceId || null,
      featureFlagKey: featureFlagKey || null,
      description: description || "Credit pack for clean watermark-free exports.",
      audience: audience || "Product sellers and creators",
      badgeText: badgeText || null,
      highlight,
      status: status as "ACTIVE" | "INACTIVE" | "SUSPENDED"
    },
    select: { id: true }
  });

  await logAdminAction({
    admin,
    action: "pricing.create_pack",
    entityType: "CreditPackage",
    entityId: pack.id,
    metadata: { name, baseCredits, bonusCredits, price, sortOrder, status }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
  revalidatePath("/");
  redirect(`/admin/pricing?saved=${encodeURIComponent(name)}`);
}

export async function deleteCreditPackageAction(formData: FormData) {
  const admin = await requireAdmin();
  const packageId = String(formData.get("packageId") || "");

  if (!packageId) {
    redirect("/admin/pricing?error=invalid");
  }

  const pack = await prisma.creditPackage.update({
    where: { id: packageId },
    data: {
      deletedAt: new Date(),
      status: "INACTIVE"
    },
    select: { id: true, name: true }
  });

  await logAdminAction({
    admin,
    action: "pricing.delete_pack",
    entityType: "CreditPackage",
    entityId: packageId,
    metadata: { name: pack.name, softDelete: true }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
  revalidatePath("/");
  redirect(`/admin/pricing?deleted=${encodeURIComponent(pack.name)}`);
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
        credits: pack.credits,
        bonusCredits: pack.bonusCredits,
        price: pack.price,
        currency: pack.currency.toLowerCase(),
        sortOrder: index + 1,
        featureFlagKey: pack.featureFlagKey,
        description: pack.description,
        audience: pack.audience,
        badgeText: pack.badgeText ?? null,
        highlight: pack.highlight,
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
  revalidatePath("/");
  redirect("/admin/pricing?saved=launch-packages");
}

export async function upsertCmsPageAction(formData: FormData) {
  const admin = await requireAdmin();
  const pageId = getFormString(formData, "pageId", 120);
  const slug = normalizeSlug(getFormString(formData, "slug", 120));
  const title = getFormString(formData, "title", 160);
  const metaTitle = getFormString(formData, "metaTitle", 180);
  const metaDescription = getFormString(formData, "metaDescription", 280);
  const bodyMarkdown = getFormString(formData, "bodyMarkdown", 20000) || getFormString(formData, "body", 20000);
  const status = getFormString(formData, "status", 20);

  if (!slug || !title || !metaTitle || !metaDescription || !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
    redirect("/admin/cms?error=invalid");
  }

  const contentJson = {
    bodyMarkdown: stripDangerousCmsContent(bodyMarkdown)
  };

  let savedPage: { id: string; slug: string } | null = null;

  try {
    savedPage = pageId
      ? await prisma.page.update({
          where: { id: pageId },
          data: {
            slug,
            title,
            metaTitle,
            metaDescription,
            contentJson,
            status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
            deletedAt: null
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
      entityId: savedPage.id,
      metadata: { slug: savedPage.slug, status }
    });

    if (process.env.NODE_ENV === "development") {
      console.info("[admin-cms-save]", {
        pageId: savedPage.id,
        slug: savedPage.slug,
        status,
        bodyLength: contentJson.bodyMarkdown.length
      });
    }

    revalidatePath("/admin/cms");
    revalidatePath(`/${savedPage.slug}`);
    revalidatePath("/", "layout");
  } catch (error) {
    console.error("[admin-cms-save-failed]", {
      slug,
      status,
      error: error instanceof Error ? error.message : "Unknown CMS save error"
    });
    redirect(`/admin/cms?error=${encodeURIComponent(slug || "cms")}`);
  }

  redirect(`/admin/cms?saved=${encodeURIComponent(savedPage.slug)}`);
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
  redirect("/admin/settings?saved=tracking");
}

export async function updateOperationalSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  const settings: OperationalSettings = {
    brandName: getFormString(formData, "brandName", 80),
    supportEmail: getFormString(formData, "supportEmail", 160),
    defaultCurrency: getFormString(formData, "defaultCurrency", 8).toUpperCase() || "USD",
    maintenanceMode: formData.get("maintenanceMode") === "on",
    cleanExportsEnabled: formData.get("cleanExportsEnabled") === "on",
    checkoutEnabled: formData.get("checkoutEnabled") === "on",
    previewEnabled: formData.get("previewEnabled") === "on",
    registrationEnabled: formData.get("registrationEnabled") === "on",
    uploadMaxSizeMb: Number(formData.get("uploadMaxSizeMb") || 10),
    guestPreviewPerMinute: Number(formData.get("guestPreviewPerMinute") || 3),
    guestPreviewPerHour: Number(formData.get("guestPreviewPerHour") || 15),
    userJobsPerMinute: Number(formData.get("userJobsPerMinute") || 10),
    userJobsPerDay: Number(formData.get("userJobsPerDay") || 100)
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
      checkoutEnabled: settings.checkoutEnabled,
      previewEnabled: settings.previewEnabled,
      registrationEnabled: settings.registrationEnabled,
      uploadMaxSizeMb: settings.uploadMaxSizeMb,
      guestPreviewPerMinute: settings.guestPreviewPerMinute,
      guestPreviewPerHour: settings.guestPreviewPerHour,
      userJobsPerMinute: settings.userJobsPerMinute,
      userJobsPerDay: settings.userJobsPerDay
    }
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=operations");
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

function getExpenseCategory(value: string): ExpenseCategory | null {
  const normalized = value.toUpperCase();
  if (["ADS", "SEO", "PROVIDER", "SOFTWARE", "DESIGN", "DOMAIN", "HOSTING", "OTHER"].includes(normalized)) {
    return normalized as ExpenseCategory;
  }
  return null;
}
