import "server-only";

import { prisma } from "@/lib/db";
import { getReferralUrl } from "@/lib/affiliate/referrals";
import { getAffiliateSettings } from "@/lib/affiliate/settings";

export async function getAffiliateDashboardData(userId: string) {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      referralCode: true,
      status: true,
      tierKey: true,
      totalClicks: true,
      totalSignups: true,
      totalPaidReferrals: true,
      totalReferredRevenue: true,
      totalRewardCredits: true,
      freezeRewards: true,
      suspicious: true,
      rewards: {
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          status: true,
          rewardCredits: true,
          paymentAmount: true,
          paymentCurrency: true,
          rewardPercentSnapshot: true,
          tierNameSnapshot: true,
          deliveredAt: true,
          createdAt: true,
          referredUser: { select: { email: true } }
        }
      },
      signups: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          suspicious: true,
          createdAt: true,
          referredUser: { select: { email: true, createdAt: true } }
        }
      }
    }
  });

  if (!profile) return null;
  const conversionRate = profile.totalClicks > 0 ? Math.round((profile.totalPaidReferrals / profile.totalClicks) * 1000) / 10 : 0;
  const settings = await getAffiliateSettings();

  return {
    profile,
    referralUrl: getReferralUrl(profile.referralCode),
    conversionRate,
    settings
  };
}

export async function getAdminAffiliateData() {
  const [settings, profiles, totals, suspiciousCount, recentRewards] = await Promise.all([
    getAffiliateSettings(),
    prisma.affiliateProfile.findMany({
      orderBy: [{ totalRewardCredits: "desc" }, { totalReferredRevenue: "desc" }, { createdAt: "desc" }],
      take: 50,
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
        fraudNotes: true,
        totalClicks: true,
        totalSignups: true,
        totalPaidReferrals: true,
        totalReferredRevenue: true,
        totalRewardCredits: true,
        updatedAt: true,
        user: { select: { email: true, name: true, creditBalance: true } }
      }
    }),
    prisma.affiliateProfile.aggregate({
      _sum: {
        totalClicks: true,
        totalSignups: true,
        totalPaidReferrals: true,
        totalReferredRevenue: true,
        totalRewardCredits: true
      }
    }),
    prisma.affiliateProfile.count({ where: { OR: [{ suspicious: true }, { status: "SUSPICIOUS" }] } }),
    prisma.referralReward.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        rewardCredits: true,
        paymentAmount: true,
        paymentCurrency: true,
        rewardPercentSnapshot: true,
        tierNameSnapshot: true,
        createdAt: true,
        affiliateUser: { select: { email: true } },
        referredUser: { select: { email: true } }
      }
    })
  ]);

  return {
    settings,
    profiles,
    recentRewards,
    summary: {
      clicks: totals._sum.totalClicks ?? 0,
      signups: totals._sum.totalSignups ?? 0,
      paidReferrals: totals._sum.totalPaidReferrals ?? 0,
      referredRevenue: Number(totals._sum.totalReferredRevenue ?? 0),
      rewardCredits: totals._sum.totalRewardCredits ?? 0,
      suspiciousCount
    }
  };
}

export async function getAffiliateAnalyticsData() {
  const [rewardGroups, clickCount, signupCount] = await Promise.all([
    prisma.referralReward.groupBy({
      by: ["status"],
      _sum: { rewardCredits: true, paymentAmount: true },
      _count: { _all: true }
    }),
    prisma.referralClick.count(),
    prisma.referralSignup.count()
  ]);

  return {
    clickCount,
    signupCount,
    rewardGroups
  };
}
