import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AppShell } from "@/components/layout/app-shell";
import { ReferralLinkCopy } from "@/components/affiliate/referral-link-copy";
import { getCurrentUserFromSession } from "@/lib/auth/current-user";
import { requireMfaIfNeeded } from "@/lib/auth/mfa";
import { getAffiliateDashboardData } from "@/lib/affiliate/data";
import { ensureAffiliateProfile } from "@/lib/affiliate/referrals";
import { prisma } from "@/lib/db";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Creator Program",
  description: "Invite ecommerce sellers and earn Zeylora AI credits from successful referral payments.",
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
      <AppShell area="dashboard" title="Creator Program" description="Invite sellers and earn platform credits from successful paid referrals.">
        <Card className="p-6">
          <p className="text-sm font-bold text-slate-300">Your creator profile is being prepared. Refresh this page in a moment.</p>
        </Card>
      </AppShell>
    );
  }
  const samplePayment = 50;
  const activeTier = data.settings.tiers.find((tier) => tier.key === data.profile.tierKey) ?? data.settings.tiers[0];
  const rewardPercent = activeTier?.rewardPercent ?? data.settings.defaultRewardPercent;
  const sampleCredits = Math.floor((samplePayment * (rewardPercent / 100)) / data.settings.estimatedCreditUsdValue);
  const rewardScope = data.settings.rewardScope === "FIRST_PAYMENT_ONLY" ? "first successful payment only" : "every successful payment";

  return (
    <AppShell
      area="dashboard"
      title="Zeylora Creator Program"
      description="Invite ecommerce sellers. Earn platform credits when referred users complete successful purchases. Rewards are credits only, not cash payouts."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Clicks" value={data.profile.totalClicks} />
        <Metric label="Signups" value={data.profile.totalSignups} />
        <Metric label="Paid conversions" value={data.profile.totalPaidReferrals} />
        <Metric label="Earned credits" value={data.profile.totalRewardCredits} />
      </div>

      <Card className="mt-4 p-5">
        <p className="eyebrow">Referral link</p>
        <h2 className="mt-2 text-xl font-black text-white">Share this link with ecommerce sellers.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          When someone signs up through your link and later completes a successful Stripe credit purchase, Zeylora converts your reward into platform credits. Signup alone does not create a reward.
        </p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-cyan">
            <span className="break-all">{data.referralUrl}</span>
          </div>
          <ReferralLinkCopy referralUrl={data.referralUrl} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/10" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("I use Zeylora AI for ecommerce product photos. Try it here: " + data.referralUrl)}`}>
            Share on X
          </Link>
          <Link className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/10" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(data.referralUrl)}`}>
            Share on LinkedIn
          </Link>
          <Link className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/10" href={`mailto:?subject=${encodeURIComponent("Try Zeylora AI")}&body=${encodeURIComponent(data.referralUrl)}`}>
            Share by email
          </Link>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-4">
        <ExplainerStep
          label="1"
          title="Share your link"
          text="Send your referral link to Shopify, Amazon, Etsy, TikTok Shop, or product-photo clients."
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
          text="Approved rewards are delivered as Zeylora platform credits. They are not cash payouts and can be used for clean exports."
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <Card className="p-5">
          <p className="eyebrow">Program rules</p>
          <h2 className="mt-2 text-xl font-black text-white">{rewardPercent}% equivalent in credits</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Your current tier is <span className="font-black text-cyan">{activeTier?.name ?? data.profile.tierKey}</span>. Rewards apply to {rewardScope}. The reward formula is payment amount × reward percentage ÷ estimated credit value.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-bold text-slate-300">
              Current tier: <span className="text-cyan">{activeTier?.name ?? data.profile.tierKey}</span>
              <br />
              Conversion rate: <span className="text-white">%{data.conversionRate}</span>
            </div>
            <div className="rounded-2xl border border-cyan/20 bg-cyan/10 p-4 text-sm font-bold text-cyan">
              Example: ${samplePayment} paid referral = about {sampleCredits} credits.
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">
            <p className="font-black text-white">When do credits appear?</p>
            <p className="mt-1">
              Credits are added after Stripe confirms the payment and the reward passes basic fraud checks. If a payment is refunded, duplicated, suspicious, or made by your own account, it will not qualify.
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <p className="eyebrow">Recent rewards</p>
          <div className="mt-4 grid gap-3">
            {data.profile.rewards.map((reward) => (
              <div key={reward.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-white">+{reward.rewardCredits} credits</p>
                  <span className="rounded-full border border-cyan/25 bg-cyan/10 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-cyan">{reward.status}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  {reward.referredUser.email} · {Number(reward.paymentAmount).toFixed(2)} {reward.paymentCurrency.toUpperCase()} · {new Date(reward.createdAt).toLocaleDateString("en-US")}
                </p>
              </div>
            ))}
            {data.profile.rewards.length === 0 ? <p className="text-sm font-bold text-slate-400">No referral rewards yet.</p> : null}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="p-5">
          <p className="eyebrow">Recent referred signups</p>
          <div className="mt-4 grid gap-3">
            {data.profile.signups.map((signup) => (
              <div key={signup.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-black text-white">{signup.referredUser.email}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    Signed up {new Date(signup.createdAt).toLocaleDateString("en-US")}
                  </p>
                </div>
                <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${signup.suspicious ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-cyan/25 bg-cyan/10 text-cyan"}`}>
                  {signup.suspicious ? "Review" : "Tracked"}
                </span>
              </div>
            ))}
            {data.profile.signups.length === 0 ? <p className="text-sm font-bold text-slate-400">No referred signups yet.</p> : null}
          </div>
        </Card>

        <Card className="p-5">
          <p className="eyebrow">Important limits</p>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-300">
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              Minimum qualifying payment: <span className="font-black text-white">${data.settings.minimumPaymentAmount}</span>
            </p>
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              Maximum reward per payment: <span className="font-black text-white">{data.settings.maxRewardCreditsPerPayment} credits</span>
            </p>
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              Monthly reward cap: <span className="font-black text-white">{data.settings.maxMonthlyRewardCreditsPerAffiliate} credits</span>
            </p>
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              Reward type: <span className="font-black text-white">platform credits only, no cash payouts</span>
            </p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </Card>
  );
}

function ExplainerStep({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <Card className="p-4">
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-cyan text-sm font-black text-slate-950">
        {label}
      </span>
      <h3 className="mt-3 text-base font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </Card>
  );
}
