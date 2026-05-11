export type ProviderBudget = {
  providerKey: string;
  monthlyBudgetLimit?: number | null;
  monthlyBudgetUsed: number;
  enforcementMode: "notify_only" | "pause_tools" | "block_jobs";
};

export function evaluateProviderBudget(provider: ProviderBudget) {
  const limit = provider.monthlyBudgetLimit;

  if (!limit || limit <= 0) {
    return { allowed: true, shouldNotify: false, shouldPauseTools: false };
  }

  const overLimit = provider.monthlyBudgetUsed >= limit;

  return {
    allowed: !overLimit || provider.enforcementMode === "notify_only",
    shouldNotify: overLimit,
    shouldPauseTools: overLimit && provider.enforcementMode === "pause_tools",
    shouldBlockJobs: overLimit && provider.enforcementMode === "block_jobs"
  };
}
