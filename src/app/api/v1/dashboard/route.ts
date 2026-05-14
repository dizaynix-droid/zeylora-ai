import { NextResponse } from "next/server";
import { getCurrentAppUserForRead } from "@/lib/auth/current-user";
import { loadDashboardOverview } from "@/lib/dashboard/data";

export async function GET() {
  const startedAt = Date.now();
  const user = await getCurrentAppUserForRead();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const overview = await loadDashboardOverview(user.id);
  const totalMs = Date.now() - startedAt;

  if (process.env.NODE_ENV === "development") {
    console.info("[dashboard-bootstrap-timing]", {
      totalMs
    });
  }

  return NextResponse.json({
    ok: true,
    user: {
      email: overview.user.email || user.email,
      name: overview.user.name,
      createdAt: overview.user.createdAt,
      creditBalance: overview.user.creditBalance
    },
    metrics: overview.metrics,
    timing: {
      ...overview.timing,
      totalMs
    }
  });
}
