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
    price: 7.99,
    currency: "USD",
    highlight: true,
    badgeText: "Start here",
    description: "Run your first serious list cleanup before a campaign launch.",
    audience: "First deliverability test",
    featureFlagKey: "pricing_pack_trial",
    paymentProviderPriceIds: {}
  },
  {
    key: "starter",
    name: "Starter",
    billingModel: "one_time_credits",
    credits: 3000,
    bonusCredits: 0,
    price: 19,
    currency: "USD",
    highlight: false,
    description: "Clean smaller marketing, ecommerce, and newsletter lists.",
    audience: "Small campaigns and founders",
    featureFlagKey: "pricing_pack_starter",
    paymentProviderPriceIds: {}
  },
  {
    key: "growth",
    name: "Growth",
    billingModel: "one_time_credits",
    credits: 10000,
    bonusCredits: 0,
    price: 49,
    currency: "USD",
    highlight: false,
    badgeText: "Popular",
    description: "Built for agencies and teams cleaning recurring campaign lists.",
    audience: "Agencies and growing teams",
    featureFlagKey: "pricing_pack_growth",
    paymentProviderPriceIds: {}
  },
  {
    key: "pro",
    name: "Pro",
    billingModel: "one_time_credits",
    credits: 25000,
    bonusCredits: 0,
    price: 99,
    currency: "USD",
    highlight: false,
    badgeText: "Best Value",
    description: "High-volume verification for cold email, ecommerce, and SaaS teams.",
    audience: "High-volume operators",
    featureFlagKey: "pricing_pack_pro",
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
    description: "Large list cleaning for serious senders protecting sender reputation.",
    audience: "Scale teams and agencies",
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
