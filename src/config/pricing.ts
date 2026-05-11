export type PricingBillingModel = "one_time_credits" | "subscription";
export type PaymentProviderKey = "stripe" | "paddle" | "lemonsqueezy";

export type CreditPackageConfig = {
  key: "starter" | "creator" | "pro-seller";
  name: string;
  billingModel: PricingBillingModel;
  credits: number;
  bonusCredits: number;
  price: number;
  currency: "USD";
  highlight: boolean;
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
    credits: 40,
    bonusCredits: 0,
    price: 9,
    currency: "USD",
    highlight: false,
    description: "Perfect for testing the studio with a few product photos.",
    audience: "New sellers and light testing",
    featureFlagKey: "pricing_pack_starter",
    paymentProviderPriceIds: {}
  },
  {
    key: "creator",
    name: "Creator",
    billingModel: "one_time_credits",
    credits: 120,
    bonusCredits: 10,
    price: 19,
    currency: "USD",
    highlight: true,
    description: "Best for creators, marketers, and frequent edits.",
    audience: "Creators and small ecommerce teams",
    featureFlagKey: "pricing_pack_creator",
    paymentProviderPriceIds: {}
  },
  {
    key: "pro-seller",
    name: "Pro Seller",
    billingModel: "one_time_credits",
    credits: 320,
    bonusCredits: 40,
    price: 39,
    currency: "USD",
    highlight: false,
    description: "For ecommerce sellers preparing larger product photo batches.",
    audience: "High-volume product sellers",
    featureFlagKey: "pricing_pack_pro_seller",
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
