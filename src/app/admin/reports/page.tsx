import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  addAdminDays,
  AdminMetricCard,
  AdminSection,
  AdminStatusPill,
  AdminTable,
  formatAdminDate,
  formatAdminDateInputValue,
  getAdminDayEndUtc,
  getAdminDayStartUtc,
  getAdminMonthEndUtc,
  getAdminMonthStartUtc,
  parseAdminDateInputEndUtc,
  parseAdminDateInputStartUtc
} from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { deleteBusinessExpenseAction, upsertBusinessExpenseAction } from "@/lib/admin/actions";
import { prisma } from "@/lib/db";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";
import type { ExpenseCategory } from "@prisma/client";

export const dynamic = "force-dynamic";

type ReportsSearchParams = {
  range?: string;
  from?: string;
  to?: string;
  expenseCategory?: string;
  saved?: string;
  deleted?: string;
  error?: string;
};

const rangeOptions = [
  ["today", "Bugün"],
  ["yesterday", "Dün"],
  ["last7", "Son 7 gün"],
  ["last30", "Son 30 gün"],
  ["thisMonth", "Bu ay"],
  ["lastMonth", "Geçen ay"],
  ["custom", "Özel aralık"]
] as const;

const EXPENSE_CATEGORIES = ["ADS", "SEO", "PROVIDER", "SOFTWARE", "DESIGN", "DOMAIN", "HOSTING", "OTHER"] as const;

const expenseCategoryLabels: Record<(typeof EXPENSE_CATEGORIES)[number], string> = {
  ADS: "Reklam",
  SEO: "SEO",
  PROVIDER: "Sağlayıcı",
  SOFTWARE: "Yazılım",
  DESIGN: "Tasarım",
  DOMAIN: "Domain",
  HOSTING: "Hosting",
  OTHER: "Diğer"
};

export default async function AdminReportsPage({
  searchParams
}: {
  searchParams?: Promise<ReportsSearchParams>;
}) {
  const pageStartedAt = adminPerfNow();
  await requireAdmin();
  const params = await searchParams;
  const data = await getVerificationReportsData(params);

  logAdminPerf("page./admin/reports", {
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    range: data.range,
    payments: data.summary.paymentCount,
    providerRows: data.providerRows.length,
    failedJobs: data.summary.failedJobCount,
    safeMode: data.safeMode
  });

  return (
    <AppShell
      area="admin"
      title="Email verification raporları"
      description="Gelir, doğrulama hacmi, provider maliyeti, gider ve net kârı mail verification ürünü için takip et."
    >
      {data.safeMode ? (
        <Notice tone="warn">
          Raporlar güvenli veri modunda açıldı. Bazı opsiyonel tablolar okunamadı; ana ödeme ve doğrulama metrikleri sıfır değerle korunuyor.
        </Notice>
      ) : null}
      {params?.saved ? <Notice tone="good">Kaydedildi: {decodeURIComponent(params.saved)}</Notice> : null}
      {params?.deleted ? <Notice tone="warn">Gider silindi: {decodeURIComponent(params.deleted)}</Notice> : null}
      {params?.error ? <Notice tone="bad">İşlem tamamlanamadı. Alanları kontrol edip tekrar deneyin.</Notice> : null}

      <AdminSection title="Filtreler" description={`${formatAdminDate(data.start)} - ${formatAdminDate(data.end)} aralığı gösteriliyor.`}>
        <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Select name="range" defaultValue={data.range} options={rangeOptions} />
          <input name="from" type="date" defaultValue={params?.from || ""} className={inputClass} />
          <input name="to" type="date" defaultValue={params?.to || ""} className={inputClass} />
          <select name="expenseCategory" defaultValue={data.expenseCategory || ""} className={inputClass}>
            <option value="">Tüm giderler</option>
            {Object.entries(expenseCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button className="h-11 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 xl:col-span-2">
            Raporu güncelle
          </button>
        </form>
      </AdminSection>

      <div className="mt-4 grid gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <AdminMetricCard label="Toplam gelir" value={formatCurrency(data.summary.revenue)} note={`${data.summary.paymentCount} başarılı ödeme`} />
        <AdminMetricCard label="Satılan doğrulama" value={data.summary.verificationsSold.toLocaleString()} note="Başarılı ödemeyle teslim edilen hak" />
        <AdminMetricCard label="Kullanılan doğrulama" value={data.summary.verificationsUsed.toLocaleString()} note="Tamamlanan verification job kullanımı" />
        <AdminMetricCard label="Sağlayıcı maliyeti" value={formatCurrency(data.summary.providerCost)} note="Verification job snapshot maliyeti" />
        <AdminMetricCard label="Manuel gider" value={formatCurrency(data.summary.manualExpenses)} note="Reklam, SEO, yazılım, domain vb." />
        <AdminMetricCard label="Net kâr" value={formatCurrency(data.summary.netProfit)} note={`Marj: ${data.summary.margin === null ? "-" : `${data.summary.margin.toFixed(1)}%`}`} />
        <AdminMetricCard label="Tamamlanan işler" value={data.summary.completedJobCount.toLocaleString()} note="Başarılı verification job" />
        <AdminMetricCard label="Hatalı işler" value={data.summary.failedJobCount.toLocaleString()} note="Provider veya sistem hatası" />
        <AdminMetricCard label="Geçersiz/riskli ayrıldı" value={data.summary.riskRemoved.toLocaleString()} note="Invalid + risky + disposable + catch-all + unknown" />
        <AdminMetricCard label="Ort. maliyet / 1K" value={formatCurrency(data.summary.costPerThousand)} note="Provider maliyeti / 1.000 doğrulama" />
        <AdminMetricCard label="Gelir / 1K" value={formatCurrency(data.summary.revenuePerThousand)} note="Ödeme geliri / 1.000 satılan doğrulama" />
        <AdminMetricCard label="İade" value={formatCurrency(data.summary.refundAmount)} note={`${data.summary.refundCount} iade/iptal kaydı`} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700">Kâr mutabakatı</p>
        <div className="mt-3 flex flex-col gap-2 text-sm font-semibold text-slate-700 lg:flex-row lg:items-center lg:gap-3">
          <span>Gelir {formatCurrency(data.summary.revenue)}</span>
          <span className="text-slate-400">-</span>
          <span>Sağlayıcı {formatCurrency(data.summary.providerCost)}</span>
          <span className="text-slate-400">-</span>
          <span>Manuel gider {formatCurrency(data.summary.manualExpenses)}</span>
          <span className="text-slate-400">=</span>
          <span className={data.summary.netProfit < 0 ? "text-rose-700" : "text-emerald-700"}>
            Net {formatCurrency(data.summary.netProfit)}
          </span>
        </div>
        <p className="mt-3 max-w-4xl text-xs leading-5 text-slate-500">
          Gelir yalnızca başarılı ödemelerden gelir. Sağlayıcı maliyeti tamamlanan verification job maliyetidir. Manuel gider reklam, yazılım, domain, SEO gibi elle girilen giderlerden düşülür.
        </p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_.8fr]">
        <AdminSection title="Email provider maliyetleri" description="Tamamlanan işlerin TR tarihine göre net provider maliyeti kullanılır; provider iadesi olan riskli/catch-all sonuçlar maliyetten düşülür.">
          <AdminTable>
            <table className="min-w-[860px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Tamamlanan</th>
                  <th className="px-4 py-3">Hatalı</th>
                  <th className="px-4 py-3">Doğrulama</th>
                  <th className="px-4 py-3">Maliyet</th>
                  <th className="px-4 py-3">Ort. / 1K</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.providerRows.map((row) => (
                  <tr key={row.providerKey}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-950">{row.name}</p>
                      <p className="text-xs text-slate-500">{row.providerKey}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.completedJobs}</td>
                    <td className="px-4 py-3 text-rose-700">{row.failedJobs}</td>
                    <td className="px-4 py-3 text-slate-700">{row.verifications.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-950">{formatCurrency(row.providerCost)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.costPerThousand)}</td>
                  </tr>
                ))}
                {data.providerRows.length === 0 ? <EmptyRow colSpan={6} message="Bu aralıkta provider kullanımı yok." /> : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>

        <div id="expenses">
          <AdminSection title="Manuel gider ekle" description="Reklam, SEO, provider, yazılım, domain ve hosting giderlerini kârlılık hesabına ekle.">
            <form action={upsertBusinessExpenseAction} className="grid gap-3">
              <input name="title" placeholder="Gider başlığı" className={inputClass} />
              <div className="grid gap-3 sm:grid-cols-3">
                <select name="category" defaultValue="ADS" className={inputClass}>
                  {Object.entries(expenseCategoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <input name="amount" type="number" min="0.01" step="0.01" placeholder="Tutar" className={inputClass} />
                <input name="currency" defaultValue="usd" className={inputClass} />
              </div>
              <input name="expenseDate" type="date" defaultValue={formatAdminDateInputValue(new Date())} className={inputClass} />
              <textarea name="note" placeholder="Not (opsiyonel)" className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              <button className="h-11 rounded-md bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700">
                Gider ekle
              </button>
            </form>
          </AdminSection>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AdminSection title="Paket geliri" description="Başarılı ödemelerin Stripe metadata ve ödeme kaydına göre paket performansı.">
          <AdminTable>
            <table className="min-w-[720px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Paket</th>
                  <th className="px-4 py-3">Ödeme</th>
                  <th className="px-4 py-3">Doğrulama</th>
                  <th className="px-4 py-3">Gelir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.packageRows.map((row) => (
                  <tr key={row.packageName}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{row.packageName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.payments}</td>
                    <td className="px-4 py-3 text-slate-700">{row.verifications.toLocaleString()}</td>
                    <td className="px-4 py-3 text-emerald-700">{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
                {data.packageRows.length === 0 ? <EmptyRow colSpan={4} message="Bu aralıkta başarılı ödeme yok." /> : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>

        <AdminSection title="Son doğrulama işleri" description="Mail verification job özetleri. Email sonuç satırları burada yüklenmez; detay sayfasında sayfalı açılır.">
          <AdminTable>
            <table className="min-w-[760px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">İş</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-950">{job.originalFilename || job.id.slice(0, 8)}</p>
                      {job.errorMessage ? <p className="mt-1 max-w-xs truncate text-xs text-rose-700">{job.errorMessage}</p> : null}
                    </td>
                    <td className="px-4 py-3"><JobStatus status={job.status} /></td>
                    <td className="px-4 py-3 text-slate-700">{job.uniqueEmails.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-700">{job.providerKey}</td>
                    <td className="px-4 py-3 text-slate-500">{formatAdminDate(job.createdAt)}</td>
                  </tr>
                ))}
                {data.recentJobs.length === 0 ? <EmptyRow colSpan={5} message="Bu aralıkta doğrulama işi yok." /> : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>
      </div>

      <div className="mt-4">
        <AdminSection title="Gider kayıtları" description="Son 50 gider kaydı. Silme işlemi soft-delete olarak uygulanır.">
          <AdminTable>
            <table className="min-w-[920px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Gider</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Kontrol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.expenses.map((expense) => (
                  <tr key={expense.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-950">{expense.title}</p>
                      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{expense.note || "Not yok"}</p>
                    </td>
                    <td className="px-4 py-3"><AdminStatusPill>{expenseCategoryLabels[expense.category]}</AdminStatusPill></td>
                    <td className="px-4 py-3 text-rose-700">{formatCurrency(Number(expense.amount), expense.currency)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatAdminDate(expense.expenseDate)}</td>
                    <td className="px-4 py-3">
                      <form action={deleteBusinessExpenseAction}>
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <button className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                          Sil
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {data.expenses.length === 0 ? <EmptyRow colSpan={5} message="Bu aralıkta gider yok." /> : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>
      </div>
    </AppShell>
  );
}

async function getVerificationReportsData(params?: ReportsSearchParams) {
  const range = normalizeRange(params?.range);
  const { start, end } = getDateRange(range, params?.from, params?.to);
  const expenseCategory = normalizeExpenseCategory(params?.expenseCategory);
  const expenseWhere = {
    deletedAt: null,
    expenseDate: { gte: start, lte: end },
    ...(expenseCategory ? { category: expenseCategory } : {})
  };

  const results = await Promise.allSettled([
    prisma.payment.aggregate({
      where: { deletedAt: null, status: "PAID", createdAt: { gte: start, lte: end } },
      _sum: { amount: true, creditsDelivered: true },
      _count: { _all: true }
    }),
    prisma.payment.aggregate({
      where: { deletedAt: null, status: { in: ["REFUNDED", "PARTIALLY_REFUNDED", "CANCELLED"] }, createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { _all: true }
    }),
    prisma.payment.findMany({
      where: { deletedAt: null, status: "PAID", createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { amount: true, creditsDelivered: true, rawEventJson: true }
    }),
    prisma.verificationJob.findMany({
      where: {
        deletedAt: null,
        status: "COMPLETED",
        OR: [
          { completedAt: { gte: start, lte: end } },
          { completedAt: null, createdAt: { gte: start, lte: end } }
        ]
      },
      orderBy: { completedAt: "desc" },
      select: {
        providerKey: true,
        uniqueEmails: true,
        creditsUsed: true,
        invalidCount: true,
        riskyCount: true,
        catchAllCount: true,
        disposableCount: true,
        unknownCount: true,
        costPerVerificationAtRun: true,
        providerCostAtRun: true,
        metadataJson: true
      }
    }),
    prisma.verificationJob.groupBy({
      by: ["providerKey"],
      where: { deletedAt: null, status: { in: ["FAILED", "PARTIAL_FAILED"] }, createdAt: { gte: start, lte: end } },
      _count: { _all: true }
    }),
    prisma.verificationJob.findMany({
      where: { deletedAt: null, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        status: true,
        originalFilename: true,
        uniqueEmails: true,
        providerKey: true,
        errorMessage: true,
        createdAt: true
      }
    }),
    prisma.businessExpense.findMany({
      where: expenseWhere,
      orderBy: { expenseDate: "desc" },
      take: 50,
      select: { id: true, title: true, category: true, amount: true, currency: true, expenseDate: true, note: true }
    }),
    prisma.providerSetting.findMany({
      where: {
        OR: [
          { providerType: { in: ["email-verification", "email_verification"] } },
          { providerKey: { contains: "million", mode: "insensitive" } },
          { name: { contains: "mail", mode: "insensitive" } }
        ]
      },
      select: { providerKey: true, name: true, estimatedCostPerRun: true }
    })
  ]);

  const paidAggregate = resultOr(results[0], { _sum: { amount: null, creditsDelivered: null }, _count: { _all: 0 } });
  const refundAggregate = resultOr(results[1], { _sum: { amount: null }, _count: { _all: 0 } });
  const paidPayments = resultOr(results[2], [] as Array<{ amount: unknown; creditsDelivered: number; rawEventJson: unknown }>);
  const completedJobs = resultOr(results[3], [] as Array<{
    providerKey: string;
    uniqueEmails: number;
    creditsUsed: number;
    invalidCount: number;
    riskyCount: number;
    catchAllCount: number;
    disposableCount: number;
    unknownCount: number;
    costPerVerificationAtRun: unknown;
    providerCostAtRun: unknown;
    metadataJson: unknown;
  }>);
  const failedJobGroups = resultOr(results[4], [] as Array<{
    providerKey: string;
    _count: { _all: number };
  }>);
  const recentJobs = resultOr(results[5], [] as Array<{
    id: string;
    status: string;
    originalFilename: string | null;
    uniqueEmails: number;
    providerKey: string;
    errorMessage: string | null;
    createdAt: Date;
  }>);
  const expenses = resultOr(results[6], [] as Array<{
    id: string;
    title: string;
    category: ExpenseCategory;
    amount: unknown;
    currency: string;
    expenseDate: Date;
    note: string | null;
  }>);
  const providers = resultOr(results[7], [] as Array<{ providerKey: string; name: string; estimatedCostPerRun: unknown }>);
  const safeMode = results.some((result) => result.status === "rejected");
  if (safeMode) {
    console.error("[admin-reports-failed]", results.filter((item) => item.status === "rejected").map((item) => item.reason instanceof Error ? item.reason.message : String(item.reason)));
  }

  const providerRows = buildProviderRows(
    completedJobs,
    failedJobGroups,
    providers
  );
  const completedProviderRows = providerRows.filter((row) => row.completedJobs > 0);
  const revenue = decimalToNumber(paidAggregate?._sum.amount);
  const verificationsSold = paidAggregate?._sum.creditsDelivered ?? 0;
  const refundAmount = decimalToNumber(refundAggregate?._sum.amount);
  const manualExpenses = expenses.reduce((sum, expense) => sum + decimalToNumber(expense.amount), 0);
  const providerCost = providerRows.reduce((sum, row) => sum + row.providerCost, 0);
  const verificationsUsed = completedProviderRows.reduce((sum, row) => sum + row.verifications, 0);
  const failedJobCount = providerRows.reduce((sum, row) => sum + row.failedJobs, 0);
  const completedJobCount = completedProviderRows.reduce((sum, row) => sum + row.completedJobs, 0);
  const riskRemoved = completedJobs.reduce((sum, job) => sum + job.invalidCount + job.riskyCount + job.catchAllCount + job.disposableCount + job.unknownCount, 0);
  const netProfit = revenue - providerCost - manualExpenses;

  return {
    range,
    start,
    end,
    expenseCategory,
    safeMode,
    summary: {
      revenue,
      paymentCount: paidAggregate?._count._all ?? 0,
      verificationsSold,
      verificationsUsed,
      providerCost,
      manualExpenses,
      netProfit,
      margin: revenue > 0 ? (netProfit / revenue) * 100 : null,
      completedJobCount,
      failedJobCount,
      riskRemoved,
      costPerThousand: verificationsUsed > 0 ? (providerCost / verificationsUsed) * 1000 : 0,
      revenuePerThousand: verificationsSold > 0 ? (revenue / verificationsSold) * 1000 : 0,
      refundAmount,
      refundCount: refundAggregate?._count._all ?? 0
    },
    providerRows,
    packageRows: buildPackageRows(paidPayments),
    recentJobs,
    expenses
  };
}

function resultOr<T>(result: PromiseSettledResult<unknown> | undefined, fallback: T): T {
  return result?.status === "fulfilled" ? (result.value as T) : fallback;
}

type CompletedVerificationJobForReport = {
  providerKey: string;
  uniqueEmails: number;
  creditsUsed: number;
  invalidCount: number;
  riskyCount: number;
  catchAllCount: number;
  disposableCount: number;
  unknownCount: number;
  costPerVerificationAtRun: unknown;
  providerCostAtRun: unknown;
  metadataJson: unknown;
};

function buildProviderRows(
  jobs: CompletedVerificationJobForReport[],
  failedGroups: Array<{
    providerKey: string;
    _count: { _all: number };
  }>,
  settings: Array<{ providerKey: string; name: string; estimatedCostPerRun: unknown }>
) {
  const names = new Map(settings.map((provider) => [provider.providerKey, provider.name]));
  const costByProvider = new Map(settings.map((provider) => [provider.providerKey, getProviderUnitCost(provider.providerKey, provider.estimatedCostPerRun)]));
  const rows = new Map<string, { providerKey: string; name: string; completedJobs: number; failedJobs: number; verifications: number; providerCost: number }>();

  for (const job of jobs) {
    const row = rows.get(job.providerKey) || {
      providerKey: job.providerKey,
      name: names.get(job.providerKey) || job.providerKey,
      completedJobs: 0,
      failedJobs: 0,
      verifications: 0,
      providerCost: 0
    };

    const verifications = job.creditsUsed || job.uniqueEmails || 0;
    row.completedJobs += 1;
    row.verifications += verifications;
    row.providerCost += getVerificationJobNetProviderCost(job, costByProvider.get(job.providerKey) ?? getProviderUnitCost(job.providerKey, null));
    rows.set(job.providerKey, row);
  }

  for (const group of failedGroups) {
    const row = rows.get(group.providerKey) || {
      providerKey: group.providerKey,
      name: names.get(group.providerKey) || group.providerKey,
      completedJobs: 0,
      failedJobs: 0,
      verifications: 0,
      providerCost: 0
    };
    row.failedJobs += group._count._all;
    rows.set(group.providerKey, row);
  }

  for (const setting of settings) {
    if (!rows.has(setting.providerKey)) {
      rows.set(setting.providerKey, {
        providerKey: setting.providerKey,
        name: setting.name,
        completedJobs: 0,
        failedJobs: 0,
        verifications: 0,
        providerCost: 0
      });
    }
  }

  return Array.from(rows.values()).map((row) => ({
    ...row,
    costPerThousand: row.verifications > 0 ? (row.providerCost / row.verifications) * 1000 : 0
  })).sort((a, b) => b.verifications - a.verifications);
}

function getVerificationJobNetProviderCost(job: CompletedVerificationJobForReport, fallbackUnitCost: number) {
  const metadata = toRecord(job.metadataJson);
  const metadataNetCost = numberFromMetadata(metadata.providerNetCostAtRun);
  if (metadataNetCost !== null) return metadataNetCost;

  const storedCost = decimalToNumber(job.providerCostAtRun);
  const storedUnitCost = decimalToNumber(job.costPerVerificationAtRun);
  const unitCost = storedUnitCost > 0 ? storedUnitCost : fallbackUnitCost;
  const refundableCredits = numberFromMetadata(metadata.providerRefundedCreditsAtRun) ?? getProviderRefundableCredits(job);

  if (storedCost > 0 && unitCost > 0) return Math.max(0, storedCost - refundableCredits * unitCost);

  const verifications = job.creditsUsed || job.uniqueEmails || 0;
  return Math.max(0, verifications - refundableCredits) * unitCost;
}

function getProviderRefundableCredits(job: CompletedVerificationJobForReport) {
  if (job.providerKey.toLowerCase() !== "millionverifier") return 0;
  return Math.max(0, job.catchAllCount + job.unknownCount);
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberFromMetadata(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function getProviderUnitCost(providerKey: string, storedCost: unknown) {
  const stored = decimalToNumber(storedCost);
  if (stored > 0) return stored;
  if (providerKey.toLowerCase() === "millionverifier") {
    const configured = Number(process.env.MILLIONVERIFIER_COST_PER_EMAIL || process.env.VERIFICATION_PROVIDER_COST_PER_EMAIL);
    return Number.isFinite(configured) && configured > 0 ? configured : 0.0001;
  }
  return 0;
}

function buildPackageRows(payments: Array<{ amount: unknown; creditsDelivered: number; rawEventJson: unknown }>) {
  const rows = new Map<string, { packageName: string; payments: number; verifications: number; revenue: number }>();
  for (const payment of payments) {
    const packageName = getPaymentPackageName(payment.rawEventJson);
    const row = rows.get(packageName) || { packageName, payments: 0, verifications: 0, revenue: 0 };
    row.payments += 1;
    row.verifications += payment.creditsDelivered || 0;
    row.revenue += decimalToNumber(payment.amount);
    rows.set(packageName, row);
  }
  return Array.from(rows.values()).sort((a, b) => b.revenue - a.revenue);
}

function getPaymentPackageName(rawEventJson: unknown) {
  if (!rawEventJson || typeof rawEventJson !== "object" || Array.isArray(rawEventJson)) return "Bilinmeyen paket";
  const record = rawEventJson as { data?: { object?: { metadata?: Record<string, unknown> } }; metadata?: Record<string, unknown> };
  const metadata = record.metadata || record.data?.object?.metadata || {};
  const name = metadata.packageName || metadata.packageId;
  return typeof name === "string" && name.trim() ? name : "Bilinmeyen paket";
}

function normalizeRange(value: string | undefined) {
  return rangeOptions.some(([key]) => key === value) ? value! : "last30";
}

function getDateRange(range: string, from?: string, to?: string) {
  const now = new Date();
  const todayStart = getAdminDayStartUtc(now);
  const todayEnd = getAdminDayEndUtc(now);
  if (range === "today") return { start: todayStart, end: todayEnd };
  if (range === "yesterday") {
    const yesterdayStart = addAdminDays(todayStart, -1);
    return { start: yesterdayStart, end: new Date(todayStart.getTime() - 1) };
  }
  if (range === "last7") return { start: addAdminDays(todayStart, -6), end: todayEnd };
  if (range === "thisMonth") return { start: getAdminMonthStartUtc(now), end: todayEnd };
  if (range === "lastMonth") {
    const thisMonthStart = getAdminMonthStartUtc(now);
    const previousMonthReference = new Date(thisMonthStart.getTime() - 1);
    return { start: getAdminMonthStartUtc(previousMonthReference), end: getAdminMonthEndUtc(previousMonthReference) };
  }
  if (range === "custom" && from && to) {
    const start = parseAdminDateInputStartUtc(from);
    const end = parseAdminDateInputEndUtc(to);
    if (start && end) return { start, end };
  }
  return { start: addAdminDays(todayStart, -29), end: todayEnd };
}

function normalizeExpenseCategory(value: string | undefined): ExpenseCategory | undefined {
  return EXPENSE_CATEGORIES.includes(value as ExpenseCategory) ? (value as ExpenseCategory) : undefined;
}

function JobStatus({ status }: { status: string }) {
  if (status === "COMPLETED") return <AdminStatusPill tone="good">Tamamlandı</AdminStatusPill>;
  if (status === "FAILED") return <AdminStatusPill tone="bad">Hatalı</AdminStatusPill>;
  if (status === "PROCESSING") return <AdminStatusPill tone="warn">İşleniyor</AdminStatusPill>;
  return <AdminStatusPill>Bekliyor</AdminStatusPill>;
}

function Select({ name, defaultValue, options }: { name: string; defaultValue: string; options: readonly (readonly [string, string])[] }) {
  return (
    <select name={name} defaultValue={defaultValue} className={inputClass}>
      {options.map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
        {message}
      </td>
    </tr>
  );
}

function Notice({ children, tone }: { children: ReactNode; tone: "good" | "warn" | "bad" }) {
  const classes = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    bad: "border-rose-200 bg-rose-50 text-rose-700"
  };
  return <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-semibold ${classes[tone]}`}>{children}</div>;
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (typeof value === "object" && "toString" in value) return Number(value.toString()) || 0;
  return 0;
}

function formatCurrency(value: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

const inputClass = "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
