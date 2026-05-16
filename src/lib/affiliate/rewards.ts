import "server-only";

import { AffiliateRewardStatus, PaymentStatus, Prisma } from "@prisma/client";
import { trackingEvents } from "@/config/tracking";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { deleteDashboardCache } from "@/lib/dashboard/cache";
import { trackServerEvent } from "@/lib/analytics/server";
import { getAffiliateSettings, resolveAffiliateTier } from "@/lib/affiliate/settings";

export async function processAffiliateRewardForPayment(input: {
  paymentId: string;
  userId: string;
  amount: number;
  currency: string;
}) {
  const settings = await getAffiliateSettings();
  if (!settings.enabled) return { rewarded: false as const, reason: "affiliate_disabled" };
  if (input.amount < settings.minimumPaymentAmount) return { rewarded: false as const, reason: "below_minimum" };

  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      userId: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true
    }
  });

  if (!payment || payment.status !== PaymentStatus.PAID || payment.userId !== input.userId) {
    return { rewarded: false as const, reason: "payment_not_paid" };
  }

  const referredUser = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      referredByUserId: true
    }
  });
  if (!referredUser?.referredByUserId || referredUser.referredByUserId === referredUser.id) {
    return { rewarded: false as const, reason: "no_referrer" };
  }

  if (settings.rewardScope === "FIRST_PAYMENT_ONLY") {
    const previousPaidPayment = await prisma.payment.findFirst({
      where: {
        userId: referredUser.id,
        status: PaymentStatus.PAID,
        id: { not: payment.id }
      },
      select: { id: true }
    });
    if (previousPaidPayment) return { rewarded: false as const, reason: "not_first_payment" };
  }

  const affiliate = await prisma.affiliateProfile.findUnique({
    where: { userId: referredUser.referredByUserId },
    select: {
      id: true,
      userId: true,
      referralCode: true,
      status: true,
      tierKey: true,
      customRewardPercent: true,
      customMonthlyCapCredits: true,
      freezeRewards: true,
      trusted: true,
      suspicious: true,
      totalPaidReferrals: true,
      totalReferredRevenue: true,
      user: { select: { email: true, creditBalance: true } }
    }
  });

  if (!affiliate || affiliate.status !== "ACTIVE" || affiliate.freezeRewards) {
    return { rewarded: false as const, reason: "affiliate_not_payable" };
  }

  const creditUsdValue = Math.max(settings.estimatedCreditUsdValue, 0.01);
  const paymentAmount = Number(payment.amount || input.amount);
  const tier = resolveAffiliateTier(settings, {
    paidReferrals: affiliate.totalPaidReferrals + 1,
    referredRevenue: Number(affiliate.totalReferredRevenue) + paymentAmount,
    tierKey: affiliate.tierKey
  });
  const rewardPercent = affiliate.customRewardPercent ? Number(affiliate.customRewardPercent) : tier.rewardPercent || settings.defaultRewardPercent;
  if (!Number.isFinite(rewardPercent) || rewardPercent <= 0) return { rewarded: false as const, reason: "zero_percent" };

  const rewardUsd = roundMoney(paymentAmount * (rewardPercent / 100));
  const uncappedRewardCredits = Math.max(1, Math.floor(rewardUsd / creditUsdValue));
  const monthlyCap = affiliate.customMonthlyCapCredits ?? tier.monthlyCapCredits ?? settings.maxMonthlyRewardCreditsPerAffiliate;
  const monthStart = new Date(payment.createdAt.getFullYear(), payment.createdAt.getMonth(), 1);
  const deliveredThisMonth = await prisma.referralReward.aggregate({
    where: {
      affiliateUserId: affiliate.userId,
      status: AffiliateRewardStatus.DELIVERED,
      createdAt: { gte: monthStart }
    },
    _sum: { rewardCredits: true }
  });
  const remainingMonthlyCap = Math.max(0, monthlyCap - (deliveredThisMonth._sum.rewardCredits ?? 0));
  const perPaymentCap = settings.maxRewardCreditsPerPayment;
  const rewardCredits = Math.min(uncappedRewardCredits, perPaymentCap, remainingMonthlyCap);
  if (rewardCredits <= 0) return { rewarded: false as const, reason: "cap_reached" };

  const fraudFlags = {
    affiliateSuspicious: affiliate.suspicious,
    trusted: affiliate.trusted,
    referredUserEmailDomain: referredUser.email.split("@")[1] || "unknown"
  };

  const delivered = await prisma.$transaction(async (tx) => {
    const existing = await tx.referralReward.findUnique({
      where: {
        paymentId_affiliateUserId: {
          paymentId: payment.id,
          affiliateUserId: affiliate.userId
        }
      },
      select: { id: true, status: true }
    });
    if (existing) return { duplicate: true as const, rewardId: existing.id, status: existing.status };

    const reward = await tx.referralReward.create({
      data: {
        affiliateProfileId: affiliate.id,
        affiliateUserId: affiliate.userId,
        referredUserId: referredUser.id,
        paymentId: payment.id,
        status: "APPROVED",
        paymentAmount,
        paymentCurrency: (payment.currency || input.currency || "usd").toLowerCase(),
        rewardPercentSnapshot: new Prisma.Decimal(rewardPercent),
        rewardUsdValueSnapshot: new Prisma.Decimal(rewardUsd),
        creditUsdValueSnapshot: new Prisma.Decimal(creditUsdValue),
        rewardCredits,
        tierKeySnapshot: tier.key,
        tierNameSnapshot: tier.name,
        ruleSnapshotJson: toJson({
          rewardScope: settings.rewardScope,
          minPayment: settings.minimumPaymentAmount,
          perPaymentCap,
          monthlyCap,
          rewardCurrencyMode: settings.rewardCurrencyMode
        }),
        fraudFlagsJson: toJson(fraudFlags)
      },
      select: { id: true }
    });

    const currentAffiliateUser = await tx.user.findUnique({
      where: { id: affiliate.userId },
      select: { creditBalance: true }
    });
    if (!currentAffiliateUser) throw new Error("Affiliate user missing.");
    const balanceAfter = currentAffiliateUser.creditBalance + rewardCredits;
    const transaction = await tx.creditTransaction.create({
      data: {
        userId: affiliate.userId,
        paymentId: payment.id,
        type: "REFERRAL_REWARD",
        amount: rewardCredits,
        balanceAfter,
        note: `Creator Program reward for referred payment ${payment.id}`
      },
      select: { id: true }
    });

    await tx.user.update({
      where: { id: affiliate.userId },
      data: { creditBalance: balanceAfter }
    });

    await tx.referralReward.update({
      where: { id: reward.id },
      data: {
        status: "DELIVERED",
        deliveredTransactionId: transaction.id,
        deliveredAt: new Date()
      }
    });

    await tx.affiliateProfile.update({
      where: { id: affiliate.id },
      data: {
        totalPaidReferrals: { increment: 1 },
        totalReferredRevenue: { increment: paymentAmount },
        totalRewardCredits: { increment: rewardCredits },
        tierKey: tier.key
      }
    });

    await tx.referral.updateMany({
      where: {
        referrerUserId: affiliate.userId,
        referredUserId: referredUser.id
      },
      data: {
        status: "REWARDED",
        rewardCredits
      }
    });

    await tx.adminLog.create({
      data: {
        action: "affiliate.reward_delivered",
        entityType: "ReferralReward",
        entityId: reward.id,
        metadataJson: toJson({ paymentId: payment.id, affiliateUserId: affiliate.userId, referredUserId: referredUser.id, rewardCredits, rewardPercent })
      }
    });

    return { duplicate: false as const, rewardId: reward.id, transactionId: transaction.id };
  });

  if ("duplicate" in delivered && delivered.duplicate) return { rewarded: false as const, reason: "duplicate", rewardId: delivered.rewardId };

  deleteDashboardCache(`dashboard:credits:${affiliate.userId}`);
  deleteDashboardCache(`dashboard:transactions:${affiliate.userId}`);
  trackServerEvent(trackingEvents.referralPurchase, {
    userId: referredUser.id,
    affiliateUserId: affiliate.userId,
    paymentId: payment.id,
    amount: paymentAmount,
    rewardCredits
  });
  trackServerEvent(trackingEvents.affiliateRewardCreated, {
    userId: affiliate.userId,
    referredUserId: referredUser.id,
    paymentId: payment.id,
    rewardCredits,
    rewardPercent
  });

  await sendTransactionalEmail({
    templateKey: "referral_reward",
    to: affiliate.user.email,
    userId: affiliate.userId,
    idempotencyKey: `referral-reward:${payment.id}:${affiliate.userId}`,
    payload: {
      credits: rewardCredits,
      amount: `${paymentAmount.toFixed(2)} ${(payment.currency || input.currency || "usd").toUpperCase()}`
    }
  });

  return { rewarded: true as const, rewardCredits, rewardId: delivered.rewardId };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value || {})) as Prisma.InputJsonValue;
}
