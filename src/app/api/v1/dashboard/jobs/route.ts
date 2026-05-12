import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/current-user";
import { loadDashboardJobs, type DashboardFilter } from "@/lib/dashboard/data";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const filter = normalizeFilter(url.searchParams.get("filter"));
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const jobs = await loadDashboardJobs(user.id, filter);

  const totalMs = Date.now() - startedAt;

  if (process.env.NODE_ENV === "development") {
    console.info("[jobs-timing]", {
      jobsMs: jobs.jobsMs,
      signedUrlsMs: jobs.signedUrlsMs,
      totalMs,
      filter,
      jobs: jobs.jobs.length,
      cacheHit: false,
      source: "db"
    });
  }

  return NextResponse.json(
    {
      ok: true,
      jobs: jobs.jobs,
      timing: {
        jobsMs: jobs.jobsMs,
        signedUrlsMs: jobs.signedUrlsMs,
        totalMs,
        cacheHit: 0
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

function normalizeFilter(filter: string | null): DashboardFilter {
  if (filter === "completed" || filter === "failed") return filter;
  return "all";
}
