import { prisma } from "@/lib/db";

const DEFAULT_CREDIT_USD_VALUE = 0.0008;
const DEFAULT_COST_PER_VERIFICATION = 0.0001;

export async function getVerificationEconomicsSnapshot(uniqueEmailCount: number) {
  const [creditValueSetting, provider] = await Promise.all([
    prisma.siteSetting
      .findUnique({
        where: { key: "estimatedVerificationCreditUsdValue" },
        select: { valueJson: true }
      })
      .catch((error) => {
        console.warn("[verification-economics-fallback]", {
          scope: "site_setting",
          message: error instanceof Error ? error.message : "SiteSetting read failed"
        });
        return null;
      }),
    prisma.providerSetting
      .findUnique({
        where: { providerKey: "millionverifier" },
        select: {
          estimatedCostPerRun: true,
          estimatedCostCurrency: true,
          status: true
        }
      })
      .catch((error) => {
        console.warn("[verification-economics-fallback]", {
          scope: "provider_setting",
          message: error instanceof Error ? error.message : "ProviderSetting read failed"
        });
        return null;
      })
  ]);

  const creditValue = readNumericSetting(creditValueSetting?.valueJson, DEFAULT_CREDIT_USD_VALUE);
  const costPerVerification = provider?.estimatedCostPerRun ? Number(provider.estimatedCostPerRun) : readCostEnv();
  const providerCost = roundMoney(uniqueEmailCount * costPerVerification);
  const estimatedRevenue = roundMoney(uniqueEmailCount * creditValue);
  const estimatedProfit = roundMoney(estimatedRevenue - providerCost);

  return {
    providerKey: "millionverifier",
    creditValue,
    costPerVerification,
    providerCost,
    providerCostCurrency: provider?.estimatedCostCurrency || "usd",
    estimatedRevenue,
    estimatedProfit
  };
}

function readCostEnv() {
  const configured = Number(process.env.MILLIONVERIFIER_COST_PER_EMAIL || process.env.VERIFICATION_PROVIDER_COST_PER_EMAIL);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_COST_PER_VERIFICATION;
}

function readNumericSetting(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "value" in value) {
    const nested = Number((value as { value?: unknown }).value);
    if (Number.isFinite(nested) && nested >= 0) return nested;
  }
  return fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
