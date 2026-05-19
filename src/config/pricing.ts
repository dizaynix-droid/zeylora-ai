export type PricingBillingModel = "one_time_credits" | "subscription";
export type PaymentProviderKey = "stripe" | "paddle" | "lemonsqueezy";

export type CreditPackageConfig = {
  key: "starter" | "growth" | "scale" | "business" | "agency" | "pro" | "enterprise" | "enterprise-plus";
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
    key: "starter",
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
    featureFlagKey: "pricing_pack_starter",
    paymentProviderPriceIds: {}
  },
  {
    key: "growth",
    name: "Growth",
    billingModel: "one_time_credits",
    credits: 5000,
    bonusCredits: 0,
    price: 29,
    currency: "USD",
    highlight: false,
    badgeText: "Growth",
    description: "Clean recurring newsletter, lead magnet, and outbound lists before sending.",
    audience: "Small campaigns and growth",
    featureFlagKey: "pricing_pack_growth",
    paymentProviderPriceIds: {}
  },
  {
    key: "scale",
    name: "Scale",
    billingModel: "one_time_credits",
    credits: 20000,
    bonusCredits: 0,
    price: 79,
    currency: "USD",
    highlight: true,
    badgeText: "Most Popular",
    description: "Built for teams verifying CRM exports, cold email lists, and higher-volume campaigns.",
    audience: "Agencies, SaaS, and growth teams",
    featureFlagKey: "pricing_pack_scale",
    paymentProviderPriceIds: {}
  },
  {
    key: "business",
    name: "Business",
    billingModel: "one_time_credits",
    credits: 50000,
    bonusCredits: 0,
    price: 149,
    currency: "USD",
    highlight: false,
    badgeText: "Scale",
    description: "High-volume verification for serious senders protecting sender reputation at scale.",
    audience: "Scale teams and outbound operations",
    featureFlagKey: "pricing_pack_business",
    paymentProviderPriceIds: {}
  },
  {
    key: "agency",
    name: "Agency",
    billingModel: "one_time_credits",
    credits: 100000,
    bonusCredits: 0,
    price: 249,
    currency: "USD",
    highlight: false,
    badgeText: "Agency",
    description: "Built for agencies and marketers running large recurring email campaigns.",
    audience: "Agencies and recurring campaigns",
    featureFlagKey: "pricing_pack_agency",
    paymentProviderPriceIds: {}
  },
  {
    key: "pro",
    name: "Pro",
    billingModel: "one_time_credits",
    credits: 250000,
    bonusCredits: 0,
    price: 449,
    currency: "USD",
    highlight: false,
    badgeText: "Pro",
    description: "High-volume verification for cold email, ecommerce, and SaaS teams.",
    audience: "High-volume operators",
    featureFlagKey: "pricing_pack_pro",
    paymentProviderPriceIds: {}
  },
  {
    key: "enterprise",
    name: "Enterprise",
    billingModel: "one_time_credits",
    credits: 500000,
    bonusCredits: 0,
    price: 799,
    currency: "USD",
    highlight: false,
    badgeText: "Enterprise",
    description: "Advanced verification capacity for enterprise outreach and large CRM operations.",
    audience: "Enterprise workflows",
    featureFlagKey: "pricing_pack_enterprise",
    paymentProviderPriceIds: {}
  },
  {
    key: "enterprise-plus",
    name: "Enterprise Plus",
    billingModel: "one_time_credits",
    credits: 1000000,
    bonusCredits: 0,
    price: 1299,
    currency: "USD",
    highlight: false,
    badgeText: "Enterprise+",
    description: "Enterprise-grade email verification infrastructure for very large databases and sender networks.",
    audience: "Maximum scale",
    featureFlagKey: "pricing_pack_enterprise_plus",
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
