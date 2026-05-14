import { NextResponse } from "next/server";
import { getCurrentAppUserForRead } from "@/lib/auth/current-user";
import { getDashboardCache, setDashboardCache } from "@/lib/dashboard/cache";
import { loadDashboardCreditTransactions } from "@/lib/dashboard/data";

const TRANSACTIONS_CACHE_TTL_MS = 30_000;

type TransactionsCacheValue = {
  creditTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    note: string | null;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
    from: number;
    to: number;
  } | null;
  transactionsMs: number;
};

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const page = normalizePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = normalizePageSize(url.searchParams.get("pageSize"), 10);
  const user = await getCurrentAppUserForRead();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const cacheKey = `dashboard:transactions:${user.id}:${page}:${pageSize}`;
  const cachedResult = getDashboardCache<TransactionsCacheValue>(cacheKey);
  const cacheHit = Boolean(cachedResult);
  const result = cachedResult ?? await loadDashboardCreditTransactions(user.id, { page, pageSize });
  if (!cachedResult) {
    setDashboardCache(cacheKey, result, TRANSACTIONS_CACHE_TTL_MS);
  }

  const totalMs = Date.now() - startedAt;

  if (process.env.NODE_ENV === "development") {
    console.info("[transactions-timing]", {
      transactionsMs: result.transactionsMs,
      totalMs,
      page,
      pageSize,
      transactions: result.creditTransactions.length,
      cacheHit,
      source: cacheHit ? "memory" : "db"
    });
  }

  return NextResponse.json({
    ok: true,
    creditTransactions: result.creditTransactions,
    pagination: result.pagination,
    timing: {
      transactionsMs: result.transactionsMs,
      totalMs,
      cacheHit: cacheHit ? 1 : 0
    }
  });
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
