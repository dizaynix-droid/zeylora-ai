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
    name: "Trial",
    billingModel: "one_time_credits",
    credits: 1000,
    bonusCredits: 0,
    price: 9,
    currency: "USD",
    highlight: true,
    badgeText: "Start here",
    description: "Verify your first list, remove risky emails, and download clean campaign segments.",
    audience: "First list quality test",
    featureFlagKey: "pricing_pack_trial",
    paymentProviderPriceIds: {}
  },
  {
    key: "starter",
    name: "Starter",
    billingModel: "one_time_credits",
    credits: 5000,
    bonusCredits: 0,
    price: 29,
    currency: "USD",
    highlight: false,
    description: "Clean regular newsletter, lead magnet, and ecommerce campaign lists before sending.",
    audience: "Small campaigns and ecommerce teams",
    featureFlagKey: "pricing_pack_starter",
    paymentProviderPriceIds: {}
  },
  {
    key: "growth",
    name: "Growth",
    billingModel: "one_time_credits",
    credits: 20000,
    bonusCredits: 0,
    price: 79,
    currency: "USD",
    highlight: false,
    badgeText: "Most Popular",
    description: "Built for teams that verify recurring outbound, CRM, and campaign lists.",
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
