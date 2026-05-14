import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentSessionUser } from "@/lib/auth/current-user";
import { requireMfaIfNeeded } from "@/lib/auth/mfa";
import { type DashboardFilter } from "@/lib/dashboard/data";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Dashboard",
  description: "Private Zeylora AI dashboard for account jobs, downloads, and credit activity.",
  path: "/dashboard",
  noIndex: true
});

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{
    filter?: string;
  }>;
}) {
  const shellStartedAt = Date.now();
  const [sessionUser, resolvedSearchParams] = await Promise.all([
    getCurrentSessionUser(),
    searchParams
  ]);

  if (!sessionUser) {
    redirect("/auth/sign-in?next=/dashboard");
  }

  await requireMfaIfNeeded("/dashboard");

  if (process.env.NODE_ENV === "development") {
    console.info("[dashboard-shell-timing]", {
      shellMs: Date.now() - shellStartedAt,
      mode: "session-only"
    });
  }

  return (
    <AppShell
      area="dashboard"
      title="Product photo workspace"
      description="Review recent edits, compare inputs and outputs, download finished assets, and track upcoming seller tools."
    >
      <DashboardClient
        initialEmail={sessionUser.email}
        initialFilter={normalizeFilter(resolvedSearchParams?.filter)}
      />
    </AppShell>
  );
}

function normalizeFilter(filter?: string): DashboardFilter {
  if (filter === "completed" || filter === "failed" || filter === "clean-export" || filter === "preview-only") return filter;
  return "all";
}
