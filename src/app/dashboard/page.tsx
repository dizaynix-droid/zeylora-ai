import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { VerificationDashboardClient } from "@/components/verification/verification-dashboard-client";
import { getCurrentSessionUser, getCurrentUserFromSessionWithTiming } from "@/lib/auth/current-user";
import { ensureFreeTrialCredits } from "@/lib/credits/ledger";
import { requireMfaIfNeeded } from "@/lib/auth/mfa";
import { prisma } from "@/lib/db";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Dashboard",
  description: "Private Zeylora AI dashboard for email verification jobs, credits, downloads, and billing.",
  path: "/dashboard",
  noIndex: true
});

export default async function DashboardPage() {
  const shellStartedAt = Date.now();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    redirect("/auth/sign-in?next=/dashboard");
  }

  await requireMfaIfNeeded("/dashboard");
  const [appUser, packages] = await Promise.all([
    prisma.user.findFirst({
      where: {
        OR: [{ id: sessionUser.id }, { email: sessionUser.email }],
        deletedAt: null
      },
      select: {
        id: true,
        email: true,
        creditBalance: true,
        freeTrialClaimed: true
      }
    }),
    getCreditPackagesForDisplay()
  ]);
  let dashboardUser = appUser;

  if (!dashboardUser) {
    const { user } = await getCurrentUserFromSessionWithTiming();
    dashboardUser = user
      ? {
          id: user.id,
          email: user.email,
          creditBalance: user.creditBalance,
          freeTrialClaimed: user.freeTrialClaimed
        }
      : null;
  } else if (!dashboardUser.freeTrialClaimed) {
    const grant = await ensureFreeTrialCredits(dashboardUser.id).catch((error) => {
      console.error("[dashboard-free-trial-grant-failed]", {
        userId: dashboardUser?.id ?? null,
        message: error instanceof Error ? error.message : String(error || "Unknown error"),
        stack: error instanceof Error ? error.stack : null
      });
      return null;
    });

    if (grant && !grant.skipped) {
      dashboardUser = {
        ...dashboardUser,
        creditBalance: grant.balanceAfter,
        freeTrialClaimed: true
      };
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[dashboard-shell-timing]", {
      shellMs: Date.now() - shellStartedAt,
      mode: "session-only"
    });
  }

  return (
    <AppShell
      area="dashboard"
      title="Email verification workspace"
      description="Upload CSV/TXT lists, remove invalid and risky emails, protect sender reputation, and download clean segmented reports."
    >
      <VerificationDashboardClient
        email={dashboardUser?.email ?? sessionUser.email}
        creditBalance={dashboardUser?.creditBalance ?? 0}
        packages={packages.map((pack) => ({
          id: pack.id,
          name: pack.name,
          price: pack.price,
          totalCredits: pack.totalCredits,
          badgeText: pack.badgeText
        }))}
      />
    </AppShell>
  );
}
