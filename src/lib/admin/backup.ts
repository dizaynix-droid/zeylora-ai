import { prisma } from "@/lib/db";
import { uploadPrivateObject, createPrivateReadUrl } from "@/lib/storage/s3-client";
import type { AdminSession } from "@/lib/admin/auth";

export type BackupHealthStatus = "HAZIR" | "UYARI" | "KRITIK";

export type BackupStatusItem = {
  label: string;
  status: BackupHealthStatus;
  value: string;
  note: string;
};

type BackupAuditSummary = {
  stripe: Awaited<ReturnType<typeof getStripeSafetyAudit>>;
  creditLedger: Awaited<ReturnType<typeof getCreditLedgerIntegrity>>;
  r2: Awaited<ReturnType<typeof getR2ObjectIntegrity>>;
};

export async function createEmergencyBackupSnapshot(admin: AdminSession) {
  assertBackupActionRateLimit(admin.email);

  const backupEvent = await prisma.backupEvent.create({
    data: {
      type: "EMERGENCY_SNAPSHOT",
      status: "PENDING",
      createdByUserId: admin.source === "role" ? admin.id : null,
      metadataJson: {
        requestedBy: admin.email,
        formats: ["json", "csv"],
        scope: "critical_business_state"
      }
    },
    select: { id: true, startedAt: true }
  });

  try {
    const [payload, audit] = await Promise.all([
      collectCriticalBackupPayload(),
      getBackupAuditSummary()
    ]);
    const snapshot = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      backupEventId: backupEvent.id,
      generatedBy: admin.email,
      safety: {
        secretPolicy: "No passwords, auth tokens, API secrets, signed URLs, or raw Stripe webhook payloads are included.",
        restorePolicy: "Restore from this export requires manual reconciliation and Supabase/R2 restore procedures."
      },
      audit,
      data: payload
    };
    const jsonBuffer = Buffer.from(JSON.stringify(snapshot, null, 2), "utf8");
    const csvBuffer = Buffer.from(buildBackupSummaryCsv(payload, audit), "utf8");
    const datePath = new Date().toISOString().slice(0, 10);
    const jsonKey = `backups/emergency/${datePath}/${backupEvent.id}.json`;
    const csvKey = `backups/emergency/${datePath}/${backupEvent.id}-summary.csv`;

    await Promise.all([
      uploadPrivateObject({
        key: jsonKey,
        body: jsonBuffer,
        contentType: "application/json; charset=utf-8",
        cacheControl: "private, no-store, max-age=0",
        metadata: {
          backupEventId: backupEvent.id,
          backupType: "emergency-snapshot"
        }
      }),
      uploadPrivateObject({
        key: csvKey,
        body: csvBuffer,
        contentType: "text/csv; charset=utf-8",
        cacheControl: "private, no-store, max-age=0",
        metadata: {
          backupEventId: backupEvent.id,
          backupType: "emergency-snapshot-summary"
        }
      })
    ]);

    const completed = await prisma.backupEvent.update({
      where: { id: backupEvent.id },
      data: {
        status: auditHasCriticalIssue(audit) ? "WARNING" : "COMPLETED",
        completedAt: new Date(),
        fileSize: jsonBuffer.length + csvBuffer.length,
        storageLocation: jsonKey,
        restoreTested: false,
        metadataJson: {
          requestedBy: admin.email,
          jsonStorageLocation: jsonKey,
          csvStorageLocation: csvKey,
          counts: getBackupPayloadCounts(payload),
          auditSummary: getAuditCounts(audit)
        }
      },
      select: { id: true, status: true, storageLocation: true }
    });

    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backup export error.";
    await prisma.backupEvent.update({
      where: { id: backupEvent.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message.slice(0, 1000)
      }
    });
    throw error;
  }
}

export async function getBackupRecoveryData() {
  const [backupEvents, restoreTests, audit] = await Promise.all([
    prisma.backupEvent.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        status: true,
        startedAt: true,
        completedAt: true,
        fileSize: true,
        storageLocation: true,
        restoreTested: true,
        errorMessage: true,
        metadataJson: true
      }
    }),
    prisma.backupEvent.findMany({
      where: { OR: [{ type: "RESTORE_TEST" }, { restoreTested: true }] },
      orderBy: { startedAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        status: true,
        startedAt: true,
        completedAt: true,
        restoreTested: true,
        errorMessage: true
      }
    }),
    getBackupAuditSummary()
  ]);
  const lastExport = backupEvents.find((event) => ["COMPLETED", "WARNING"].includes(event.status));
  const lastFailed = backupEvents.find((event) => event.status === "FAILED");
  const statusItems = buildBackupStatusItems({
    lastExport,
    lastRestoreTest: restoreTests[0],
    audit
  });

  return {
    statusItems,
    backupEvents,
    restoreTests,
    audit,
    lastExport,
    lastFailed,
    criticalWarnings: buildCriticalWarnings(audit, statusItems)
  };
}

async function collectCriticalBackupPayload() {
  const [
    users,
    payments,
    creditTransactions,
    tickets,
    ticketMessages,
    jobs,
    mediaAssets,
    providerSettings
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        creditBalance: true,
        status: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        stripeCheckoutSessionId: true,
        stripePaymentIntentId: true,
        amount: true,
        currency: true,
        creditsDelivered: true,
        status: true,
        couponCode: true,
        deletedAt: true,
        createdAt: true
      }
    }),
    prisma.creditTransaction.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        type: true,
        amount: true,
        balanceAfter: true,
        aiJobId: true,
        paymentId: true,
        note: true,
        createdAt: true
      }
    }),
    prisma.ticket.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        aiJobId: true,
        category: true,
        status: true,
        subject: true,
        lastMessageAt: true,
        closedAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.ticketMessage.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        ticketId: true,
        userId: true,
        actorType: true,
        body: true,
        createdAt: true
      }
    }),
    prisma.aiJob.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        toolId: true,
        providerKey: true,
        providerRequestId: true,
        status: true,
        inputImageId: true,
        outputImageId: true,
        creditCost: true,
        estimatedCostAtRun: true,
        estimatedCostCurrency: true,
        estimatedCostProvider: true,
        estimatedCostSource: true,
        estimatedRevenueAtRun: true,
        estimatedProfitAtRun: true,
        toolNameSnapshot: true,
        toolInternalKeySnapshot: true,
        qualityTierSnapshot: true,
        providerKeySnapshot: true,
        creditsChargedSnapshot: true,
        errorMessage: true,
        processingTimeMs: true,
        retryCount: true,
        fallbackAttempted: true,
        fallbackProviderKey: true,
        toolVersion: true,
        deletedAt: true,
        createdAt: true,
        completedAt: true
      }
    }),
    prisma.mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        type: true,
        storageKey: true,
        originalFilename: true,
        checksum: true,
        mimeType: true,
        fileSize: true,
        width: true,
        height: true,
        visibility: true,
        processingStatus: true,
        optimizedStorageKey: true,
        deletedAt: true,
        createdAt: true
      }
    }),
    prisma.providerSetting.findMany({
      orderBy: { priority: "asc" },
      select: {
        id: true,
        providerKey: true,
        name: true,
        providerType: true,
        status: true,
        envKeyName: true,
        dailyBudgetLimit: true,
        monthlyBudgetLimit: true,
        monthlyBudgetUsed: true,
        estimatedCostPerRun: true,
        estimatedCostCurrency: true,
        budgetEnforcementMode: true,
        priority: true,
        notes: true,
        createdAt: true,
        updatedAt: true
      }
    })
  ]);

  return {
    users,
    balances: users.map((user) => ({
      userId: user.id,
      email: user.email,
      creditBalance: user.creditBalance,
      status: user.status,
      deletedAt: user.deletedAt
    })),
    payments,
    creditTransactions,
    tickets,
    ticketMessages,
    jobs,
    mediaAssets,
    providerSettings
  };
}

async function getBackupAuditSummary() {
  const [stripe, creditLedger, r2] = await Promise.all([
    getStripeSafetyAudit(),
    getCreditLedgerIntegrity(),
    getR2ObjectIntegrity()
  ]);

  return { stripe, creditLedger, r2 };
}

async function getStripeSafetyAudit() {
  const [
    paidPayments,
    purchaseTransactions,
    negativeBalances,
    invalidSnapshots
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { deletedAt: null, status: "PAID" },
      select: { id: true, userId: true, amount: true, creditsDelivered: true, createdAt: true }
    }),
    prisma.creditTransaction.findMany({
      where: { type: "PURCHASE" },
      select: { id: true, paymentId: true, userId: true, amount: true, createdAt: true }
    }),
    prisma.user.findMany({
      where: { creditBalance: { lt: 0 }, deletedAt: null },
      take: 25,
      select: { id: true, email: true, creditBalance: true }
    }),
    prisma.aiJob.findMany({
      where: {
        deletedAt: null,
        status: "COMPLETED",
        OR: [
          { estimatedCostAtRun: null },
          { estimatedCostCurrency: null },
          { estimatedCostProvider: null },
          { estimatedCostSource: null }
        ]
      },
      take: 25,
      select: { id: true, toolNameSnapshot: true, providerKey: true, createdAt: true }
    })
  ]);
  const duplicateCreditRows = Array.from(
    purchaseTransactions
      .filter((transaction) => transaction.paymentId)
      .reduce((map, transaction) => {
        const paymentId = transaction.paymentId as string;
        map.set(paymentId, (map.get(paymentId) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
      .entries()
  )
    .filter(([, count]) => count > 1)
    .slice(0, 25)
    .map(([paymentId, count]) => ({ paymentId, count }));
  const purchasePaymentIds = new Set(purchaseTransactions.map((transaction) => transaction.paymentId).filter(Boolean));
  const paidPaymentIds = new Set(paidPayments.map((payment) => payment.id));
  const paymentsWithoutTransaction = paidPayments
    .filter((payment) => !purchasePaymentIds.has(payment.id))
    .slice(0, 25);
  const transactionsWithoutPayment = purchaseTransactions
    .filter((transaction) => transaction.paymentId && !paidPaymentIds.has(transaction.paymentId))
    .slice(0, 25);
  const orphanPurchaseTransactions = purchaseTransactions
    .filter((transaction) => !transaction.paymentId)
    .slice(0, 25);

  return {
    duplicateCredits: duplicateCreditRows,
    paymentsWithoutTransaction,
    transactionsWithoutPayment,
    orphanPurchaseTransactions,
    negativeBalances,
    invalidSnapshots,
    counts: {
      duplicateCredits: duplicateCreditRows.length,
      paymentsWithoutTransaction: paymentsWithoutTransaction.length,
      transactionsWithoutPayment: transactionsWithoutPayment.length,
      orphanPurchaseTransactions: orphanPurchaseTransactions.length,
      negativeBalances: negativeBalances.length,
      invalidSnapshots: invalidSnapshots.length
    }
  };
}

async function getCreditLedgerIntegrity() {
  const [users, ledgerRows] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      take: 1000,
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, creditBalance: true }
    }),
    prisma.creditTransaction.groupBy({
      by: ["userId"],
      _sum: { amount: true },
      _count: { _all: true }
    })
  ]);
  const ledgerByUserId = new Map(ledgerRows.map((row) => [row.userId, row]));
  const mismatches = users
    .map((user) => {
      const ledger = ledgerByUserId.get(user.id);
      const ledgerBalance = ledger?._sum.amount ?? 0;
      return {
        userId: user.id,
        email: user.email,
        storedBalance: user.creditBalance,
        ledgerBalance,
        transactionCount: ledger?._count._all ?? 0,
        difference: user.creditBalance - ledgerBalance
      };
    })
    .filter((row) => row.difference !== 0)
    .slice(0, 50);

  return {
    checkedUsers: users.length,
    mismatches,
    mismatchCount: mismatches.length,
    truncated: users.length >= 1000
  };
}

async function getR2ObjectIntegrity() {
  const [completedMissingOutput, mediaWithoutKey, sampleAssets] = await Promise.all([
    prisma.aiJob.count({
      where: {
        deletedAt: null,
        status: "COMPLETED",
        outputImageId: null
      }
    }),
    prisma.mediaAsset.count({ where: { deletedAt: null, storageKey: "" } }),
    prisma.mediaAsset.findMany({
      where: { deletedAt: null, type: "RESULT" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, storageKey: true }
    })
  ]);
  const configured = Boolean(process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
  const brokenSignedUrlSamples: Array<{ id: string; error: string }> = [];

  if (configured) {
    for (const asset of sampleAssets) {
      try {
        await createPrivateReadUrl(asset.storageKey, 60);
      } catch (error) {
        brokenSignedUrlSamples.push({
          id: asset.id,
          error: error instanceof Error ? error.message : "signed url error"
        });
      }
    }
  }

  return {
    configured,
    completedMissingOutput,
    mediaWithoutKey,
    checkedSignedUrlSamples: configured ? sampleAssets.length : 0,
    brokenSignedUrlSamples,
    orphanedObjectsNote: "R2 object listing is intentionally not automated yet. Use bucket inventory for full orphan detection.",
    counts: {
      completedMissingOutput,
      mediaWithoutKey,
      brokenSignedUrls: brokenSignedUrlSamples.length
    }
  };
}

function buildBackupStatusItems(input: {
  lastExport?: { completedAt: Date | null; status: string; fileSize: number | null } | null;
  lastRestoreTest?: { completedAt: Date | null; startedAt: Date; status: string } | null;
  audit: BackupAuditSummary;
}): BackupStatusItem[] {
  const supabasePitrEnabled = process.env.SUPABASE_PITR_ENABLED === "true";
  const supabaseLastBackupAt = process.env.SUPABASE_LAST_BACKUP_AT || "";
  const exportAgeMs = input.lastExport?.completedAt ? Date.now() - input.lastExport.completedAt.getTime() : Number.POSITIVE_INFINITY;
  const exportStatus: BackupHealthStatus = exportAgeMs < 86_400_000 ? "HAZIR" : input.lastExport ? "UYARI" : "KRITIK";
  const auditCritical = auditHasCriticalIssue(input.audit);

  return [
    {
      label: "Supabase backup / PITR",
      status: supabasePitrEnabled ? "HAZIR" : "UYARI",
      value: supabasePitrEnabled ? "PITR aktif olarak işaretli" : "Manuel kontrol gerekli",
      note: "SUPABASE_PITR_ENABLED=true ile dashboard kontrolünü işaretleyebilirsin."
    },
    {
      label: "Son DB backup zamanı",
      status: supabaseLastBackupAt ? "HAZIR" : "UYARI",
      value: supabaseLastBackupAt || "Env ile işaretlenmemiş",
      note: "Supabase otomatik backup zamanı dashboarddan doğrulanmalı."
    },
    {
      label: "Son başarılı export",
      status: exportStatus,
      value: input.lastExport?.completedAt ? input.lastExport.completedAt.toLocaleString("tr-TR") : "Henüz export yok",
      note: input.lastExport?.fileSize ? `${formatBytes(input.lastExport.fileSize)} private R2 snapshot` : "Emergency snapshot üret."
    },
    {
      label: "R2 object storage",
      status: input.audit.r2.configured && input.audit.r2.counts.brokenSignedUrls === 0 ? "HAZIR" : "KRITIK",
      value: input.audit.r2.configured ? "R2 env hazır" : "R2 env eksik",
      note: `${input.audit.r2.checkedSignedUrlSamples} signed URL örneği kontrol edildi.`
    },
    {
      label: "Backup verification",
      status: auditCritical ? "KRITIK" : "HAZIR",
      value: auditCritical ? "Kritik uyarı var" : "Ledger/audit temiz",
      note: "Stripe, kredi ledger ve R2 tutarlılık kontrolleri."
    },
    {
      label: "Restore test",
      status: input.lastRestoreTest?.status === "COMPLETED" ? "HAZIR" : "UYARI",
      value: input.lastRestoreTest?.completedAt ? input.lastRestoreTest.completedAt.toLocaleString("tr-TR") : "Restore testi yok",
      note: "Canlı DB üstüne otomatik restore yapılmaz; staging simülasyonu önerilir."
    },
    {
      label: "Deployment rollback",
      status: process.env.VERCEL_GIT_COMMIT_SHA ? "HAZIR" : "UYARI",
      value: process.env.VERCEL_GIT_COMMIT_SHA ? "Vercel deployment izlenebilir" : "Local/commit env yok",
      note: "Vercel Deployments ekranından tek tık rollback akışı."
    }
  ];
}

function buildCriticalWarnings(audit: BackupAuditSummary, statusItems: BackupStatusItem[]) {
  const warnings: string[] = [];
  if (statusItems.some((item) => item.status === "KRITIK")) warnings.push("Kritik backup/recovery durum kartı var.");
  if (audit.stripe.counts.duplicateCredits > 0) warnings.push("Aynı ödeme için birden fazla kredi hareketi tespit edildi.");
  if (audit.stripe.counts.paymentsWithoutTransaction > 0) warnings.push("Ödemesi başarılı ama kredi transaction kaydı olmayan ödeme var.");
  if (audit.stripe.counts.negativeBalances > 0) warnings.push("Negatif kredi bakiyeli kullanıcı var.");
  if (audit.creditLedger.mismatchCount > 0) warnings.push("Stored credit balance ile ledger toplamı uyuşmayan kullanıcı var.");
  if (audit.r2.counts.completedMissingOutput > 0) warnings.push("Tamamlanmış job içinde output dosyası eksik kayıt var.");
  if (audit.r2.counts.brokenSignedUrls > 0) warnings.push("Bazı R2 signed URL örnekleri üretilemedi.");
  return warnings;
}

function auditHasCriticalIssue(audit: BackupAuditSummary) {
  return (
    audit.stripe.counts.duplicateCredits > 0 ||
    audit.stripe.counts.paymentsWithoutTransaction > 0 ||
    audit.stripe.counts.negativeBalances > 0 ||
    audit.creditLedger.mismatchCount > 0 ||
    audit.r2.counts.completedMissingOutput > 0 ||
    audit.r2.counts.brokenSignedUrls > 0
  );
}

function getBackupPayloadCounts(payload: Awaited<ReturnType<typeof collectCriticalBackupPayload>>) {
  return {
    users: payload.users.length,
    balances: payload.balances.length,
    payments: payload.payments.length,
    creditTransactions: payload.creditTransactions.length,
    tickets: payload.tickets.length,
    ticketMessages: payload.ticketMessages.length,
    jobs: payload.jobs.length,
    mediaAssets: payload.mediaAssets.length,
    providerSettings: payload.providerSettings.length
  };
}

function getAuditCounts(audit: BackupAuditSummary) {
  return {
    stripe: audit.stripe.counts,
    creditLedger: {
      checkedUsers: audit.creditLedger.checkedUsers,
      mismatchCount: audit.creditLedger.mismatchCount
    },
    r2: audit.r2.counts
  };
}

function buildBackupSummaryCsv(
  payload: Awaited<ReturnType<typeof collectCriticalBackupPayload>>,
  audit: BackupAuditSummary
) {
  const rows = [
    ["section", "metric", "value"],
    ["counts", "users", payload.users.length],
    ["counts", "payments", payload.payments.length],
    ["counts", "credit_transactions", payload.creditTransactions.length],
    ["counts", "jobs", payload.jobs.length],
    ["counts", "tickets", payload.tickets.length],
    ["audit", "duplicate_credits", audit.stripe.counts.duplicateCredits],
    ["audit", "payments_without_transaction", audit.stripe.counts.paymentsWithoutTransaction],
    ["audit", "negative_balances", audit.stripe.counts.negativeBalances],
    ["audit", "credit_ledger_mismatches", audit.creditLedger.mismatchCount],
    ["audit", "completed_jobs_missing_output", audit.r2.counts.completedMissingOutput],
    ["audit", "broken_signed_url_samples", audit.r2.counts.brokenSignedUrls]
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string | number) {
  const raw = String(value);
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const backupActionRateLimit = new Map<string, number>();

function assertBackupActionRateLimit(adminEmail: string) {
  const key = adminEmail.toLowerCase();
  const now = Date.now();
  const previous = backupActionRateLimit.get(key) ?? 0;
  const cooldownMs = 120_000;

  if (now - previous < cooldownMs) {
    throw new Error("Backup snapshot action is rate limited. Please wait before running another export.");
  }

  backupActionRateLimit.set(key, now);
}
