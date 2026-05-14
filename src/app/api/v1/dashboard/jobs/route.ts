import { NextResponse } from "next/server";
import { getCurrentAppUserForRead } from "@/lib/auth/current-user";
import { loadDashboardJobs, type DashboardFilter } from "@/lib/dashboard/data";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const filter = normalizeFilter(url.searchParams.get("filter"));
  const page = normalizePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = normalizePageSize(url.searchParams.get("pageSize"), 10);
  const tool = normalizeTool(url.searchParams.get("tool"));
  const q = normalizeQuery(url.searchParams.get("q"));
  const user = await getCurrentAppUserForRead();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const jobs = await loadDashboardJobs(user.id, {
    filter,
    page,
    pageSize,
    tool,
    q
  });

  const totalMs = Date.now() - startedAt;

  if (process.env.NODE_ENV === "development") {
    console.info("[jobs-timing]", {
      jobsMs: jobs.jobsMs,
      signedUrlsMs: jobs.signedUrlsMs,
      totalMs,
      filter,
      page,
      pageSize,
      tool,
      hasQuery: Boolean(q),
      jobs: jobs.jobs.length,
      cacheHit: false,
      source: "db",
      userId: user.id
    });
  }

  return NextResponse.json(
    {
      ok: true,
      jobs: jobs.jobs,
      pagination: jobs.pagination,
      tools: jobs.tools,
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
  if (filter === "completed" || filter === "failed" || filter === "clean-export" || filter === "preview-only") return filter;
  return "all";
}

function normalizePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function normalizePageSize(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(20, Math.max(5, parsed));
}

function normalizeTool(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^[a-z0-9-]{2,80}$/.test(trimmed)) return null;
  return trimmed;
}

function normalizeQuery(value: string | null) {
  const trimmed = value?.trim().slice(0, 80) || "";
  return trimmed || null;
}
