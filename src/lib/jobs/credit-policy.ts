import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { businessFoundation } from "@/config/business";
import { reserveCreditsForJob, refundCreditsForJob } from "@/lib/credits/ledger";
import { trackServerEvent } from "@/lib/analytics/server";
import { trackingEvents } from "@/config/tracking";

export type ExportMode = "free_watermarked" | "paid_clean";

export type JobCreditPlan = {
  exportMode: ExportMode;
  creditCost: number;
  canCharge: boolean;
  charged: boolean;
  balanceBefore: number;
  balanceAfter?: number;
};

export function createJobCreditPlan(user: AuthenticatedUser, creditCost: number): JobCreditPlan {
  void businessFoundation;
  const normalizedCost = Math.max(0, creditCost);
  const canCharge = normalizedCost > 0 && user.creditBalance >= normalizedCost;

  return {
    exportMode: canCharge ? "paid_clean" : "free_watermarked",
    creditCost: normalizedCost,
    canCharge,
    charged: false,
    balanceBefore: user.creditBalance
  };
}

export async function reserveJobCredits(input: {
  userId: string;
  jobId: string;
  toolKey: string;
  plan: JobCreditPlan;
}) {
  if (!input.plan.canCharge) {
    throw new Error("insufficient_credits");
  }

  const reservation = await reserveCreditsForJob({
    userId: input.userId,
    aiJobId: input.jobId,
    amount: input.plan.creditCost,
    note: `${input.toolKey} paid clean export`
  });

  if (!reservation.ok) {
    throw new Error("insufficient_credits");
  }

  trackServerEvent(trackingEvents.creditsSpent, {
    tool: input.toolKey,
    jobId: input.jobId,
    credits: input.plan.creditCost
  });
  trackServerEvent(trackingEvents.watermarkFreeExport, {
    tool: input.toolKey,
    jobId: input.jobId,
    credits: input.plan.creditCost
  });

  return {
    ...input.plan,
    exportMode: "paid_clean" as const,
    canCharge: true,
    charged: true,
    balanceAfter: reservation.balanceAfter
  };
}

export async function refundJobCredits(input: {
  userId: string;
  jobId: string;
  toolKey: string;
  plan: JobCreditPlan;
}) {
  if (!input.plan.charged) {
    return null;
  }

  return refundCreditsForJob({
    userId: input.userId,
    aiJobId: input.jobId,
    amount: input.plan.creditCost,
    note: `${input.toolKey} failed job refund`
  });
}
