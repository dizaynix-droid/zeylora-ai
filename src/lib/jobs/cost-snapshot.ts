import type { Prisma } from "@prisma/client";
import { resolveToolEconomy } from "@/config/tool-economy";
import { prisma } from "@/lib/db";
import { getOperationalSettings } from "@/lib/settings/operations";

export type JobCostSnapshotSource = "TOOL_TIER" | "TOOL_OVERRIDE" | "PROVIDER_DEFAULT" | "NONE";

type JobCostSnapshotUpdate = Pick<
  Prisma.AiJobUncheckedUpdateInput,
  | "costEstimate"
  | "toolNameSnapshot"
  | "toolInternalKeySnapshot"
  | "qualityTierSnapshot"
  | "providerKeySnapshot"
  | "creditsChargedSnapshot"
  | "estimatedCostAtRun"
  | "estimatedCostCurrency"
  | "estimatedCostProvider"
  | "estimatedCostSource"
  | "estimatedRevenueAtRun"
  | "estimatedProfitAtRun"
>;

export async function buildJobCostSnapshotUpdate(
  jobId: string,
  overrides: {
    providerKey?: string;
    qualityTier?: string;
    internalKey?: string;
    publicName?: string;
    creditCost?: number;
  } = {}
): Promise<Partial<JobCostSnapshotUpdate>> {
  const job = await prisma.aiJob.findUnique({
    where: { id: jobId },
    select: {
      creditCost: true,
      providerKey: true,
      providerKeySnapshot: true,
      creditsChargedSnapshot: true,
      qualityTierSnapshot: true,
      toolInternalKeySnapshot: true,
      toolNameSnapshot: true,
      estimatedCostAtRun: true,
      estimatedRevenueAtRun: true,
      estimatedProfitAtRun: true,
      tool: {
        select: {
          name: true,
          slug: true,
          publicName: true,
          internalKey: true,
          qualityTier: true,
          providerKey: true,
          estimatedCostPerRun: true,
          estimatedCostCurrency: true,
          estimatedCostProvider: true
        }
      }
    }
  });

  if (!job) return {};
  if (
    job.estimatedCostAtRun !== null &&
    job.estimatedRevenueAtRun !== null &&
    job.estimatedProfitAtRun !== null &&
    job.toolInternalKeySnapshot &&
    job.qualityTierSnapshot &&
    job.providerKeySnapshot
  ) {
    return {};
  }

  const [provider, operations] = await Promise.all([
    prisma.providerSetting.findUnique({
      where: { providerKey: overrides.providerKey || job.providerKeySnapshot || job.providerKey },
      select: {
        providerKey: true,
        name: true,
        estimatedCostPerRun: true,
        estimatedCostCurrency: true
      }
    }),
    getOperationalSettings()
  ]);

  const economy = resolveToolEconomy({
    toolSlug: job.tool?.slug || "unknown",
    qualityMode: overrides.qualityTier || job.qualityTierSnapshot || job.tool?.qualityTier || undefined,
    providerKey: overrides.providerKey || job.providerKeySnapshot || job.providerKey || job.tool?.providerKey || undefined
  });
  const toolCost = decimalToNumber(job.tool?.estimatedCostPerRun);
  const providerCost = decimalToNumber(provider?.estimatedCostPerRun);
  const tierCost = economy.estimatedProviderCost;
  const costSource: JobCostSnapshotSource = tierCost > 0
    ? "TOOL_TIER"
    : toolCost > 0
      ? "TOOL_OVERRIDE"
      : providerCost > 0
        ? "PROVIDER_DEFAULT"
        : "NONE";
  const cost = costSource === "TOOL_TIER"
    ? tierCost
    : costSource === "TOOL_OVERRIDE"
      ? toolCost
      : costSource === "PROVIDER_DEFAULT"
        ? providerCost
        : 0;
  const currency =
    (costSource === "TOOL_TIER" ? economy.providerCurrency : null) ||
    (costSource === "TOOL_OVERRIDE" ? job.tool?.estimatedCostCurrency : provider?.estimatedCostCurrency) ||
    provider?.estimatedCostCurrency ||
    "usd";
  const providerName =
    overrides.providerKey ||
    (costSource === "TOOL_TIER" ? economy.providerKey : null) ||
    (costSource === "TOOL_OVERRIDE" ? job.tool?.estimatedCostProvider : null) ||
    provider?.providerKey ||
    job.providerKey;
  const creditsCharged = overrides.creditCost ?? job.creditsChargedSnapshot ?? job.creditCost;
  const estimatedRevenue = roundMoney(creditsCharged * operations.estimatedCreditUsdValue);
  const estimatedProfit = roundMoney(estimatedRevenue - cost);

  return {
    toolNameSnapshot: job.toolNameSnapshot || overrides.publicName || job.tool?.publicName || economy.publicName || job.tool?.name || null,
    toolInternalKeySnapshot: job.toolInternalKeySnapshot || overrides.internalKey || job.tool?.internalKey || economy.internalKey || null,
    qualityTierSnapshot: overrides.qualityTier || job.qualityTierSnapshot || job.tool?.qualityTier || economy.qualityTier,
    providerKeySnapshot: overrides.providerKey || job.providerKeySnapshot || economy.providerKey || job.providerKey,
    creditsChargedSnapshot: creditsCharged,
    costEstimate: cost > 0 ? cost : null,
    estimatedCostAtRun: job.estimatedCostAtRun ?? cost,
    estimatedCostCurrency: currency.toLowerCase(),
    estimatedCostProvider: providerName,
    estimatedCostSource: costSource,
    estimatedRevenueAtRun: estimatedRevenue,
    estimatedProfitAtRun: estimatedProfit
  };
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toString" in value) return Number(value.toString());
  return Number(value) || 0;
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}
