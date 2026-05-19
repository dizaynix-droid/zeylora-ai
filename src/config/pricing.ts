export type PricingBillingModel = "one_time_credits" | "subscription";
export type PaymentProviderKey = "stripe" | "paddle" | "lemonsqueezy";

export type CreditPackageConfig = {
  key: "trial" | "starter" | "growth" | "pro" | "business";
  name: string;
  billingModel: PricingBillingModel;
  credits: number;
  bonusCredits: number;
  price: number;
  currency: "USD";
  highlight: boolean;
  badgeText?: string;
  description: string;
  audience: string;
  featureFlagKey: string;
  paymentProviderPriceIds: Partial<Record<PaymentProviderKey, string>>;
};

export const creditPackages: CreditPackageConfig[] = [
  {
    key: "trial",
    name: "Starter",
    billingModel: "one_time_credits",
    credits: 1000,
    bonusCredits: 0,
    price: 9,
    currency: "USD",
    highlight: true,
    badgeText: "Start here",
    description: "Verify your first 1,000 emails, reduce bounce risk, and export clean CSV segments.",
    audience: "First list quality check",
    featureFlagKey: "pricing_pack_trial",
    paymentProviderPriceIds: {}
  },
  {
    key: "starter",
    name: "Growth",
    billingModel: "one_time_credits",
    credits: 5000,
    bonusCredits: 0,
    price: 29,
    currency: "USD",
    highlight: false,
    description: "Clean recurring newsletter, lead magnet, and outbound lists before sending.",
    audience: "Small campaigns and growth teams",
    featureFlagKey: "pricing_pack_starter",
    paymentProviderPriceIds: {}
  },
  {
    key: "growth",
    name: "Scale",
    billingModel: "one_time_credits",
    credits: 20000,
    bonusCredits: 0,
    price: 79,
    currency: "USD",
    highlight: false,
    badgeText: "Most Popular",
    description: "Built for teams verifying CRM exports, cold email lists, and higher-volume campaigns.",
    audience: "Agencies, SaaS, and growth teams",
    featureFlagKey: "pricing_pack_growth",
    paymentProviderPriceIds: {}
  },
  {
    key: "business",
    name: "Business",
    billingModel: "one_time_credits",
    credits: 60000,
    bonusCredits: 0,
    price: 199,
    currency: "USD",
    highlight: false,
    badgeText: "Scale",
    description: "High-volume verification for serious senders protecting sender reputation at scale.",
    audience: "Scale teams, agencies, and operators",
    featureFlagKey: "pricing_pack_business",
    paymentProviderPriceIds: {}
  }
] as const satisfies CreditPackageConfig[];

export const subscriptionPricingRoadmap = {
  enabled: false,
  featureFlagKey: "subscriptions",
  billingModels: ["monthly_credits", "monthly_allowance", "team_workspace"],
  futureProviders: ["stripe", "paddle", "lemonsqueezy"] as PaymentProviderKey[]
} as const;

export const paymentProviderRoadmap = {
  activeProvider: null,
  preparedProviders: ["stripe", "paddle", "lemonsqueezy"] as PaymentProviderKey[],
  checkoutEnabledFeatureFlag: "credit_checkout"
} as const;
