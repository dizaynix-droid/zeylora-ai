export type PricingBillingModel = "one_time_credits" | "subscription";
export type PaymentProviderKey = "stripe" | "paddle" | "lemonsqueezy";

export type CreditPackageConfig = {
  key: "starter-trial" | "starter" | "creator" | "pro-seller" | "business";
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
    key: "starter-trial",
    name: "Starter Trial Pack",
    billingModel: "one_time_credits",
    credits: 15,
    bonusCredits: 0,
    price: 7.99,
    currency: "USD",
    highlight: true,
    badgeText: "Most Popular",
    description: "A low-risk first test pack for turning your first product photos into marketplace-ready visuals.",
    audience: "First product test, no subscription",
    featureFlagKey: "pricing_pack_starter_trial",
    paymentProviderPriceIds: {}
  },
  {
    key: "starter",
    name: "Starter",
    billingModel: "one_time_credits",
    credits: 20,
    bonusCredits: 0,
    price: 19,
    currency: "USD",
    highlight: false,
    description: "A focused credit pack for small batches, listing refreshes, and clean ecommerce exports.",
    audience: "New sellers and first product batches",
    featureFlagKey: "pricing_pack_starter",
    paymentProviderPriceIds: {}
  },
  {
    key: "creator",
    name: "Creator",
    billingModel: "one_time_credits",
    credits: 45,
    bonusCredits: 5,
    price: 39,
    currency: "USD",
    highlight: false,
    badgeText: "Seller Pack",
    description: "A practical seller pack for recurring catalog edits, relights, crops, upscales, and clean exports.",
    audience: "Shopify, Etsy, and TikTok Shop sellers",
    featureFlagKey: "pricing_pack_creator",
    paymentProviderPriceIds: {}
  },
  {
    key: "pro-seller",
    name: "Pro Seller",
    billingModel: "one_time_credits",
    credits: 100,
    bonusCredits: 20,
    price: 79,
    currency: "USD",
    highlight: false,
    badgeText: "Best Value",
    description: "Built for larger product batches, marketplace listing refreshes, and ad creative production.",
    audience: "Growing ecommerce stores",
    featureFlagKey: "pricing_pack_pro_seller",
    paymentProviderPriceIds: {}
  },
  {
    key: "business",
    name: "Business",
    billingModel: "one_time_credits",
    credits: 220,
    bonusCredits: 40,
    price: 149,
    currency: "USD",
    highlight: false,
    badgeText: "Scale",
    description: "For operators and teams producing clean product visuals across marketplaces, stores, and paid channels.",
    audience: "Agencies, catalog teams, and high-volume sellers",
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
