import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/current-user";
import { getDashboardCache, setDashboardCache } from "@/lib/dashboard/cache";
import { loadDashboardJobs, type DashboardFilter } from "@/lib/dashboard/data";

const EMPTY_JOBS_CACHE_TTL_MS = 10_000;

type JobsCacheValue = {
  jobs: Awaited<ReturnType<typeof loadDashboardJobs>>["jobs"];
  jobsMs: number;
  signedUrlsMs: number;
};

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const filter = normalizeFilter(url.searchParams.get("filter"));
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const cacheKey = `dashboard:jobs:${user.id}:${filter}`;
  const cachedJobs = getDashboardCache<JobsCacheValue>(cacheKey);
  const cacheHit = Boolean(cachedJobs);
  const jobs = cachedJobs ?? await loadDashboardJobs(user.id, filter);
  if (!cachedJobs) {
    setDashboardCache(cacheKey, jobs, EMPTY_JOBS_CACHE_TTL_MS);
  }

  const totalMs = Date.now() - startedAt;

  if (process.env.NODE_ENV === "development") {
    console.info("[jobs-timing]", {
      jobsMs: jobs.jobsMs,
      signedUrlsMs: jobs.signedUrlsMs,
      totalMs,
      filter,
      jobs: jobs.jobs.length,
      cacheHit,
      source: cacheHit ? "memory" : "db"
    });
  }

  return NextResponse.json({
    ok: true,
    jobs: jobs.jobs,
    timing: {
      jobsMs: jobs.jobsMs,
      signedUrlsMs: jobs.signedUrlsMs,
      totalMs,
      cacheHit: cacheHit ? 1 : 0
    }
  });
}

function normalizeFilter(filter: string | null): DashboardFilter {
  if (filter === "completed" || filter === "failed") return filter;
  return "all";
}
