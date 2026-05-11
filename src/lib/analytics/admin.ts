export type ToolUsageMetric = {
  toolSlug: string;
  jobs: number;
  revenueEstimate: number;
  failureRate: number;
  providerCostEstimate: number;
};

export function sortToolsByRevenue(metrics: ToolUsageMetric[]) {
  return [...metrics].sort((a, b) => b.revenueEstimate - a.revenueEstimate);
}
