import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOperationalSettings } from "@/lib/settings/operations";

export type JobCostSnapshotSource = "TOOL_OVERRIDE" | "PROVIDER_DEFAULT" | "NONE";

type JobCostSnapshotUpdate = Pick<
  Prisma.AiJobUncheckedUpdateInput,
  | "costEstimate"
  | "estimatedCostAtRun"
  | "estimatedCostCurrency"
  | "estimatedCostProvider"
  | "estimatedCostSource"
  | "estimatedRevenueAtRun"
  | "estimatedProfitAtRun"
>;

export async function buildJobCostSnapshotUpdate(jobId: string): Promise<Partial<JobCostSnapshotUpdate>> {
  const job = await prisma.aiJob.findUnique({
    where: { id: jobId },
    select: {
      creditCost: true,
      providerKey: true,
      estimatedCostAtRun: true,
      tool: {
        select: {
          estimatedCostPerRun: true,
          estimatedCostCurrency: true,
          estimatedCostProvider: true
        }
      }
    }
  });

  if (!job || job.estimatedCostAtRun !== null) return {};

  const [provider, operations] = await Promise.all([
    prisma.providerSetting.findUnique({
      where: { providerKey: job.providerKey },
      select: {
        providerKey: true,
        name: true,
        estimatedCostPerRun: true,
        estimatedCostCurrency: true
      }
    }),
    getOperationalSettings()
  ]);

  const toolCost = decimalToNumber(job.tool?.estimatedCostPerRun);
  const providerCost = decimalToNumber(provider?.estimatedCostPerRun);
  const costSource: JobCostSnapshotSource = toolCost > 0 ? "TOOL_OVERRIDE" : providerCost > 0 ? "PROVIDER_DEFAULT" : "NONE";
  const cost = costSource === "TOOL_OVERRIDE" ? toolCost : costSource === "PROVIDER_DEFAULT" ? providerCost : 0;
  const currency =
    (costSource === "TOOL_OVERRIDE" ? job.tool?.estimatedCostCurrency : provider?.estimatedCostCurrency) ||
    provider?.estimatedCostCurrency ||
    "usd";
  const providerName =
    (costSource === "TOOL_OVERRIDE" ? job.tool?.estimatedCostProvider : null) ||
    provider?.providerKey ||
    job.providerKey;
  const estimatedRevenue = roundMoney(job.creditCost * operations.estimatedCreditUsdValue);
  const estimatedProfit = roundMoney(estimatedRevenue - cost);

  return {
    costEstimate: cost > 0 ? cost : null,
    estimatedCostAtRun: cost,
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
