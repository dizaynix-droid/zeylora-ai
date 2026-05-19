import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ReferralLinkCopy } from "@/components/affiliate/referral-link-copy";
import { VerifyBadge, VerifyMetric, VerifyPanel } from "@/components/verify-ui/core";
import { getCurrentUserFromSession } from "@/lib/auth/current-user";
import { requireMfaIfNeeded } from "@/lib/auth/mfa";
import { getAffiliateDashboardData } from "@/lib/affiliate/data";
import { ensureAffiliateProfile } from "@/lib/affiliate/referrals";
import { resolveAffiliateTier, type AffiliateTierConfig } from "@/lib/affiliate/settings";
import { prisma } from "@/lib/db";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Partner Program",
  description: "Invite marketers, agencies, and operators to verify email lists and earn Zeylora verification credits.",
  path: "/dashboard/affiliate",
  noIndex: true
});

export default async function DashboardAffiliatePage() {
  const sessionUser = await getCurrentUserFromSession();
  if (!sessionUser) redirect("/auth/sign-in?next=/dashboard/affiliate");
  await requireMfaIfNeeded("/dashboard/affiliate");

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, email: true, name: true, affiliateCode: true }
  });
  if (!user) redirect("/auth/sign-in?next=/dashboard/affiliate");
  await ensureAffiliateProfile(user);
  const data = await getAffiliateDashboardData(user.id);

  if (!data) {
    return (
      <AppShell area="dashboard" title="Partner Program" description="Invite teams to clean email lists and earn verification credits from successful paid referrals.">
        <VerifyPanel className="p-6">
          <p className="text-sm font-semibold text-slate-600">Your partner profile is being prepared. Refresh this page in a moment.</p>
        </VerifyPanel>
      </AppShell>
    );
  }
  const samplePayment = 50;
  const activeTier = resolveAffiliateTier(data.settings, {
    paidReferrals: data.profile.totalPaidReferrals,
    referredRevenue: Number(data.profile.totalReferredRevenue),
    tierKey: data.profile.tierKey
  });
  const rewardPercent = activeTier?.rewardPercent ?? data.settings.defaultRewardPercent;
  const sampleCredits = Math.floor((samplePayment * (rewardPercent / 100)) / data.settings.estimatedCreditUsdValue);
  const rewardScope = data.settings.rewardScope === "FIRST_PAYMENT_ONLY" ? "first successful payment only" : "every successful payment";
  const activeTiers = data.settings.tiers.filter((tier) => tier.active);
  const activeTierIndex = Math.max(0, activeTiers.findIndex((tier) => tier.key === activeTier?.key));
  const nextTier = activeTiers[activeTierIndex + 1] ?? null;
  const paidProgress = nextTier ? Math.min(100, Math.round((data.profile.totalPaidReferrals / Math.max(nextTier.requiredPaidReferrals, 1)) * 100)) : 100;
  const revenueProgress = nextTier ? Math.min(100, Math.round((Number(data.profile.totalReferredRevenue) / Math.max(nextTier.requiredReferredRevenue, 1)) * 100)) : 100;

  return (
    <AppShell
      area="dashboard"
      title="Zeylora Partner Program"
      description="Invite marketers, agencies, SaaS teams, and ecommerce operators. Earn verification credits when referred users complete successful purchases. Rewards are credits only, not cash payouts."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <VerifyMetric label="Referral clicks" value={data.profile.totalClicks} />
        <VerifyMetric label="Signups" value={data.profile.totalSignups} />
        <VerifyMetric label="Paid conversions" value={data.profile.totalPaidReferrals} tone="green" />
        <VerifyMetric label="Earned credits" value={data.profile.totalRewardCredits} tone="blue" />
      </div>

      <VerifyPanel className="mt-4 p-5">
        <VerifyBadge tone="blue">Referral link</VerifyBadge>
        <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">Share this link with list owners.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          When someone signs up through your link and later completes a successful Stripe credit purchase, Zeylora converts your reward into verification credits. Signup alone does not create a reward.
        </p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-blue-700">
            <span className="break-all">{data.referralUrl}</span>
          </div>
          <ReferralLinkCopy referralUrl={data.referralUrl} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link className="rounded-md border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("I use Zeylora to clean email lists before campaigns. Try it here: " + data.referralUrl)}`}>
            Share on X
          </Link>
          <Link className="rounded-md border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(data.referralUrl)}`}>
            Share on LinkedIn
          </Link>
          <Link className="rounded-md border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`mailto:?subject=${encodeURIComponent("Clean your email list with Zeylora")}&body=${encodeURIComponent(data.referralUrl)}`}>
            Share by email
          </Link>
        </div>
      </VerifyPanel>

      <div className="mt-4 grid gap-4 xl:grid-cols-4">
        <ExplainerStep
          label="1"
          title="Share your link"
          text="Send your referral link to marketers, agencies, SaaS teams, cold email operators, or ecommerce list owners."
        />
        <ExplainerStep
          label="2"
          title="They create an account"
          text="The signup is attributed to you if the referral cookie/session is valid. Self-referrals do not qualify."
        />
        <ExplainerStep
          label="3"
          title="They complete payment"
          text="Rewards are created only after a successful Stripe payment. Failed, cancelled, refunded, or duplicate payments are ignored."
        />
        <ExplainerStep
          label="4"
          title="You receive credits"
          text="Approved rewards are delivered as Zeylora verification credits. They are not cash payouts and can be used to verify more emails."
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <VerifyPanel className="p-5">
          <VerifyBadge>Program rules</VerifyBadge>
          <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">{rewardPercent}% equivalent in credits</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your current tier is <span className="font-semibold text-blue-700">{activeTier?.name ?? data.profile.tierKey}</span>. Rewards apply to {rewardScope}. The reward formula is payment amount × reward percentage ÷ estimated credit value.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-600">
              Current tier: <span className="font-semibold text-blue-700">{activeTier?.name ?? data.profile.tierKey}</span>
              <br />
              Conversion rate: <span className="font-semibold text-slate-950">%{data.conversionRate}</span>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-700">
              Example: ${samplePayment} paid referral = about {sampleCredits} credits.
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-950">When do credits appear?</p>
            <p className="mt-1">
              Credits are added after Stripe confirms the payment and the reward passes basic fraud checks. If a payment is refunded, duplicated, suspicious, or made by your own account, it will not qualify.
            </p>
          </div>
        </VerifyPanel>

        <VerifyPanel className="p-5">
          <VerifyBadge>Recent rewards</VerifyBadge>
          <div className="mt-4 grid gap-3">
            {data.profile.rewards.map((reward) => (
              <div key={reward.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">+{reward.rewardCredits} credits</p>
                  <VerifyBadge tone="green">{reward.status}</VerifyBadge>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {reward.referredUser.email} · {Number(reward.paymentAmount).toFixed(2)} {reward.paymentCurrency.toUpperCase()} · {new Date(reward.createdAt).toLocaleDateString("en-US")}
                </p>
              </div>
            ))}
            {data.profile.rewards.length === 0 ? <p className="text-sm font-semibold text-slate-500">No referral rewards yet.</p> : null}
          </div>
        </VerifyPanel>
      </div>

      <VerifyPanel className="mt-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <VerifyBadge>Partner tiers</VerifyBadge>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">Higher tiers earn higher verification-credit rewards.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Bring more paid verification users and your reward percentage increases automatically. Admin can still apply trusted/special overrides when needed.
            </p>
          </div>
          {nextTier ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
              Next: {nextTier.name} · {nextTier.rewardPercent}% rewards
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              You are on the highest active tier.
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {activeTiers.map((tier, index) => (
            <TierCard
              key={tier.key}
              tier={tier}
              active={tier.key === activeTier?.key}
              locked={index > activeTierIndex}
              creditValue={data.settings.estimatedCreditUsdValue}
            />
          ))}
        </div>

        {nextTier ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <ProgressCard
              label="Paid referral progress"
              value={`${data.profile.totalPaidReferrals} / ${nextTier.requiredPaidReferrals}`}
              percent={paidProgress}
              helper={`${Math.max(nextTier.requiredPaidReferrals - data.profile.totalPaidReferrals, 0)} more paid referrals to reach ${nextTier.name}.`}
            />
            <ProgressCard
              label="Referred revenue progress"
              value={`$${Number(data.profile.totalReferredRevenue).toFixed(2)} / $${nextTier.requiredReferredRevenue}`}
              percent={revenueProgress}
              helper={`$${Math.max(nextTier.requiredReferredRevenue - Number(data.profile.totalReferredRevenue), 0).toFixed(2)} more referred revenue to reach ${nextTier.name}.`}
            />
          </div>
        ) : null}
      </VerifyPanel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <VerifyPanel className="p-5">
          <VerifyBadge>Recent referred signups</VerifyBadge>
          <div className="mt-4 grid gap-3">
            {data.profile.signups.map((signup) => (
              <div key={signup.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{signup.referredUser.email}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Signed up {new Date(signup.createdAt).toLocaleDateString("en-US")}
                  </p>
                </div>
                <span className={`w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase ${signup.suspicious ? "border-amber-200 bg-amber-50 text-amber-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                  {signup.suspicious ? "Review" : "Tracked"}
                </span>
              </div>
            ))}
            {data.profile.signups.length === 0 ? <p className="text-sm font-semibold text-slate-500">No referred signups yet.</p> : null}
          </div>
        </VerifyPanel>

        <VerifyPanel className="p-5">
          <VerifyBadge>Important limits</VerifyBadge>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              Minimum qualifying payment: <span className="font-semibold text-slate-950">${data.settings.minimumPaymentAmount}</span>
            </p>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              Maximum reward per payment: <span className="font-semibold text-slate-950">{data.settings.maxRewardCreditsPerPayment} credits</span>
            </p>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              Monthly reward cap: <span className="font-semibold text-slate-950">{data.settings.maxMonthlyRewardCreditsPerAffiliate} credits</span>
            </p>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              Reward type: <span className="font-semibold text-slate-950">verification credits only, no cash payouts</span>
            </p>
          </div>
        </VerifyPanel>
      </div>
    </AppShell>
  );
}

function ExplainerStep({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <VerifyPanel className="p-4">
      <span className="inline-flex size-8 items-center justify-center rounded-md bg-blue-600 text-sm font-semibold text-white">
        {label}
      </span>
      <h3 className="mt-3 text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </VerifyPanel>
  );
}

function TierCard({
  tier,
  active,
  locked,
  creditValue
}: {
  tier: AffiliateTierConfig;
  active: boolean;
  locked: boolean;
  creditValue: number;
}) {
  const examplePayment = 50;
  const exampleCredits = Math.floor((examplePayment * (tier.rewardPercent / 100)) / Math.max(creditValue, 0.01));

  return (
    <div className={`rounded-lg border p-4 ${active ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-950">{tier.name}</p>
          <p className="mt-1 text-3xl font-semibold text-blue-700">{tier.rewardPercent}%</p>
        </div>
        <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${active ? "border-blue-200 bg-white text-blue-700" : locked ? "border-slate-200 bg-slate-50 text-slate-500" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {active ? "Current" : locked ? "Unlock" : "Reached"}
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-600">
        <p>
          Requirement: <span className="font-semibold text-slate-950">{tier.requiredPaidReferrals} paid referrals</span>
        </p>
        <p>
          Revenue target: <span className="font-semibold text-slate-950">${tier.requiredReferredRevenue}</span>
        </p>
        <p>
          Monthly cap: <span className="font-semibold text-slate-950">{tier.monthlyCapCredits} credits</span>
        </p>
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 font-semibold text-blue-700">
          Example: ${examplePayment} referral payment = about {exampleCredits} credits.
        </p>
      </div>
    </div>
  );
}

function ProgressCard({ label, value, percent, helper }: { label: string; value: string; percent: number; helper: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-950">{value}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs font-medium leading-5 text-slate-500">{helper}</p>
    </div>
  );
}
