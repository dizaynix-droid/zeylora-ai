import type { CreditTransactionType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { businessFoundation } from "@/config/business";
import {
  buildFreeTrialSignals,
  ensureFreeTrialClaimStoreReady,
  findFreeTrialConflict,
  insertFreeTrialGrantClaim,
  recordBlockedFreeTrialClaim,
  type FreeTrialGrantContext
} from "@/lib/credits/free-trial-abuse";
import { deleteDashboardCachePrefix, setDashboardCache } from "@/lib/dashboard/cache";

type CreditMutationInput = {
  userId: string;
  amount: number;
  aiJobId?: string;
  paymentId?: string;
  note?: string;
};

export async function getCreditBalance(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditBalance: true,
      freeTrialClaimed: true
    }
  });

  return {
    balance: user?.creditBalance ?? 0,
    freeTrialClaimed: Boolean(user?.freeTrialClaimed),
    lowCreditThreshold: businessFoundation.credits.lowCreditThreshold
  };
}

export async function listCreditTransactions(userId: string, take = 6) {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      note: true,
      createdAt: true
    }
  });
}

export async function grantFreeTrialCredits(userId: string, credits = businessFoundation.credits.freeTrialCredits, context: FreeTrialGrantContext = {}) {
  const amount = Math.max(0, Math.floor(credits));

  if (!amount) {
    const balance = await getCreditBalance(userId);

    return {
      balanceAfter: balance.balance,
      skipped: true as const,
      transaction: null,
      reason: "free_trial_disabled" as const
    };
  }

  await ensureFreeTrialClaimStoreReady();

  const result = await prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<Array<{ id: string; email: string; creditBalance: number; freeTrialClaimed: boolean }>>(Prisma.sql`
      SELECT "id", "email", "creditBalance", "freeTrialClaimed"
      FROM "User"
      WHERE "id" = ${userId}
      FOR UPDATE
    `);
    const user = users[0];

    if (!user) {
      throw new Error("User not found for free trial credit grant.");
    }

    if (user.freeTrialClaimed) {
      return {
        balanceAfter: user.creditBalance,
        skipped: true as const,
        transaction: null,
        reason: "already_claimed" as const
      };
    }

    const signals = await buildFreeTrialSignals(context.email || user.email, context);
    const conflict = await findFreeTrialConflict(tx, { userId, signals });

    if (conflict) {
      await tx.user.update({
        where: { id: userId },
        data: {
          freeTrialClaimed: true
        },
        select: { id: true }
      });
      await recordBlockedFreeTrialClaim(tx, {
        userId,
        signals,
        reason: conflict.reason,
        matchedClaimId: conflict.claimId,
        matchedUserId: conflict.matchedUserId
      });
      await tx.adminLog.create({
        data: {
          action: "free_trial.blocked",
          entityType: "User",
          entityId: userId,
          metadataJson: {
            reason: conflict.reason,
            matchedClaimId: conflict.claimId,
            matchedUserId: conflict.matchedUserId,
            hasIp: Boolean(signals.ipHash),
            hasUserAgent: Boolean(signals.userAgentHash),
            hasDevice: Boolean(signals.deviceHash),
            hasIpUserAgent: Boolean(signals.ipUserAgentHash),
            country: signals.country
          }
        }
      });

      return {
        balanceAfter: user.creditBalance,
        skipped: true as const,
        transaction: null,
        reason: "abuse_blocked" as const,
        blockReason: conflict.reason
      };
    }

    const claimId = await insertFreeTrialGrantClaim(tx, {
      userId,
      amount,
      signals
    });

    if (!claimId) {
      await tx.user.update({
        where: { id: userId },
        data: {
          freeTrialClaimed: true
        },
        select: { id: true }
      });
      await recordBlockedFreeTrialClaim(tx, {
        userId,
        signals,
        reason: "claim_insert_conflict"
      });
      await tx.adminLog.create({
        data: {
          action: "free_trial.blocked",
          entityType: "User",
          entityId: userId,
          metadataJson: {
            reason: "claim_insert_conflict",
            hasIp: Boolean(signals.ipHash),
            hasUserAgent: Boolean(signals.userAgentHash),
            hasDevice: Boolean(signals.deviceHash),
            hasIpUserAgent: Boolean(signals.ipUserAgentHash),
            country: signals.country
          }
        }
      });

      return {
        balanceAfter: user.creditBalance,
        skipped: true as const,
        transaction: null,
        reason: "abuse_blocked" as const,
        blockReason: "claim_insert_conflict" as const
      };
    }

    const balanceAfter = user.creditBalance + amount;

    const [updatedUser, transaction] = await Promise.all([
      tx.user.update({
        where: { id: userId },
        data: {
          creditBalance: balanceAfter,
          freeTrialClaimed: true
        },
        select: {
          creditBalance: true
        }
      }),
      tx.creditTransaction.create({
        data: {
          userId,
          type: "FREE_TRIAL",
          amount,
          balanceAfter,
          note: `Free trial: ${amount.toLocaleString("en-US")} email verifications`
        }
      }),
      tx.adminLog.create({
        data: {
          action: "free_trial.granted",
          entityType: "User",
          entityId: userId,
          metadataJson: {
            claimId,
            amount,
            hasIp: Boolean(signals.ipHash),
            hasUserAgent: Boolean(signals.userAgentHash),
            hasDevice: Boolean(signals.deviceHash),
            hasIpUserAgent: Boolean(signals.ipUserAgentHash),
            country: signals.country
          }
        }
      })
    ]);

    return {
      balanceAfter: updatedUser.creditBalance,
      skipped: false as const,
      transaction,
      reason: null
    };
  });

  refreshCreditDashboardCache(userId, result.balanceAfter, true);
  deleteDashboardCachePrefix(`dashboard:transactions:${userId}:`);

  return result;
}

export async function ensureFreeTrialCredits(userId: string, credits = businessFoundation.credits.freeTrialCredits, context: FreeTrialGrantContext = {}) {
  return grantFreeTrialCredits(userId, credits, context);
}

export async function reserveCreditsForJob(input: CreditMutationInput) {
  const amount = Math.abs(input.amount);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: {
        creditBalance: true,
        freeTrialClaimed: true
      }
    });

    if (!user) {
      throw new Error("User not found for credit reservation.");
    }

    if (user.creditBalance < amount) {
      return {
        ok: false as const,
        reason: "insufficient_credits" as const,
        balance: user.creditBalance,
        required: amount
      };
    }

    const balanceAfter = user.creditBalance - amount;

    const [updatedUser, transaction] = await Promise.all([
      tx.user.update({
        where: { id: input.userId },
        data: {
          creditBalance: balanceAfter
        },
        select: {
          creditBalance: true
        }
      }),
      tx.creditTransaction.create({
        data: {
          userId: input.userId,
          type: "USE",
          amount: -amount,
          balanceAfter,
          aiJobId: input.aiJobId,
          paymentId: input.paymentId,
          note: input.note || "AI_JOB_DEDUCTION"
        }
      })
    ]);

    refreshCreditDashboardCache(input.userId, updatedUser.creditBalance, user.freeTrialClaimed);
    deleteDashboardCachePrefix(`dashboard:transactions:${input.userId}:`);

    return {
      ok: true as const,
      balanceAfter: updatedUser.creditBalance,
      transaction
    };
  });
}

export async function deductCreditsForJob(input: CreditMutationInput) {
  return mutateCredits({
    ...input,
    amount: -Math.abs(input.amount),
    type: "USE",
    note: input.note || "AI job credit use"
  });
}

export async function refundCreditsForJob(input: CreditMutationInput) {
  return mutateCredits({
    ...input,
    amount: Math.abs(input.amount),
    type: "REFUND",
    note: input.note || "AI job credit refund"
  });
}

export async function addPurchasedCredits(input: CreditMutationInput) {
  return mutateCredits({
    ...input,
    amount: Math.abs(input.amount),
    type: "PURCHASE",
    note: input.note || "Purchased credits"
  });
}

async function mutateCredits(
  input: CreditMutationInput & { type: CreditTransactionType },
  options: { markFreeTrialClaimed?: boolean; skipIfAlreadyClaimed?: boolean } = {}
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: {
        creditBalance: true,
        freeTrialClaimed: true
      }
    });

    if (!user) {
      throw new Error("User not found for credit mutation.");
    }

    if (options.skipIfAlreadyClaimed && user.freeTrialClaimed) {
      return {
        balanceAfter: user.creditBalance,
        skipped: true as const,
        transaction: null
      };
    }

    const balanceAfter = user.creditBalance + input.amount;

    const [updatedUser, transaction] = await Promise.all([
      tx.user.update({
        where: { id: input.userId },
        data: {
          creditBalance: balanceAfter,
          ...(options.markFreeTrialClaimed ? { freeTrialClaimed: true } : {})
        },
        select: { creditBalance: true }
      }),
      tx.creditTransaction.create({
        data: {
          userId: input.userId,
          type: input.type,
          amount: input.amount,
          balanceAfter,
          aiJobId: input.aiJobId,
          paymentId: input.paymentId,
          note: input.note
        }
      })
    ]);

    refreshCreditDashboardCache(
      input.userId,
      updatedUser.creditBalance,
      options.markFreeTrialClaimed ? true : user.freeTrialClaimed
    );
    deleteDashboardCachePrefix(`dashboard:transactions:${input.userId}:`);

    return {
      balanceAfter: updatedUser.creditBalance,
      skipped: false as const,
      transaction
    };
  });
}

function refreshCreditDashboardCache(userId: string, creditBalance: number, freeTrialClaimed = true) {
  setDashboardCache(
    `dashboard:credits:${userId}`,
    {
      creditBalance,
      freeTrialClaimed,
      lowCreditThreshold: businessFoundation.credits.lowCreditThreshold
    },
    30_000
  );
}
