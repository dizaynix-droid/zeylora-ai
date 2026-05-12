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
  transactionsMs: number;
};

export async function GET() {
  const startedAt = Date.now();
  const user = await getCurrentAppUserForRead();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const cacheKey = `dashboard:transactions:${user.id}`;
  const cachedResult = getDashboardCache<TransactionsCacheValue>(cacheKey);
  const cacheHit = Boolean(cachedResult);
  const result = cachedResult ?? await loadDashboardCreditTransactions(user.id);
  if (!cachedResult) {
    setDashboardCache(cacheKey, result, TRANSACTIONS_CACHE_TTL_MS);
  }

  const totalMs = Date.now() - startedAt;

  if (process.env.NODE_ENV === "development") {
    console.info("[transactions-timing]", {
      transactionsMs: result.transactionsMs,
      totalMs,
      transactions: result.creditTransactions.length,
      cacheHit,
      source: cacheHit ? "memory" : "db"
    });
  }

  return NextResponse.json({
    ok: true,
    creditTransactions: result.creditTransactions,
    timing: {
      transactionsMs: result.transactionsMs,
      totalMs,
      cacheHit: cacheHit ? 1 : 0
    }
  });
}
