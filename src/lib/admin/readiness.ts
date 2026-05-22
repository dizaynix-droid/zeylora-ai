import { prisma } from "@/lib/db";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

let readinessPromise: Promise<void> | null = null;

const adminPerformanceIndexStatements = [
  `CREATE INDEX IF NOT EXISTS "User_deletedAt_createdAt_idx" ON "User"("deletedAt", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "CreditTransaction_createdAt_idx" ON "CreditTransaction"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "VerificationJob_deletedAt_createdAt_idx" ON "VerificationJob"("deletedAt", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "VerificationJob_deletedAt_status_createdAt_idx" ON "VerificationJob"("deletedAt", "status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Payment_deletedAt_createdAt_idx" ON "Payment"("deletedAt", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Payment_deletedAt_status_createdAt_idx" ON "Payment"("deletedAt", "status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AdminLog_createdAt_idx" ON "AdminLog"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AdminLog_action_createdAt_idx" ON "AdminLog"("action", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "WebhookLog_source_createdAt_idx" ON "WebhookLog"("source", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "EmailEvent_status_updatedAt_idx" ON "EmailEvent"("status", "updatedAt")`,
  `CREATE INDEX IF NOT EXISTS "EmailEvent_status_sentAt_idx" ON "EmailEvent"("status", "sentAt")`,
  `CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt")`
] as const;

export async function ensureAdminPerformanceIndexes(source = "admin") {
  if (!readinessPromise) {
    readinessPromise = runAdminPerformanceReadiness(source);
  }

  await readinessPromise;
}

async function runAdminPerformanceReadiness(source: string) {
  const startedAt = adminPerfNow();
  let failedCount = 0;

  for (const statement of adminPerformanceIndexStatements) {
    try {
      await prisma.$executeRawUnsafe(statement);
    } catch (error) {
      failedCount += 1;
      console.warn("[admin-performance-index-skipped]", {
        source,
        error: error instanceof Error ? error.message : "Admin performance index failed"
      });
    }
  }

  logAdminPerf("admin.performance.indexes", {
    duration: `${adminPerfNow() - startedAt}ms`,
    source,
    statementCount: adminPerformanceIndexStatements.length,
    failedCount
  });
}
