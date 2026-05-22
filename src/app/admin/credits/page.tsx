import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminPaginationControls, AdminSection, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminCreditsData, normalizeAdminCreditsRange, normalizeAdminPage, type AdminCreditsRange } from "@/lib/admin/data";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

export default async function AdminCreditsPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string; range?: string }>;
}) {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const params = await searchParams;
  const page = normalizeAdminPage(params?.page);
  const range = normalizeAdminCreditsRange(params?.range);
  const dataStartedAt = adminPerfNow();
  const { data, error } = await getSafeCreditsData(page, range);
  logAdminPerf("page./admin/credits [admin-perf]", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    page,
    range,
    resultCount: data.transactions.length
  });

  return (
    <AppShell
      area="admin"
      title="Doğrulama hakkı defteri"
      description="Satın alma, kullanım, iade ve admin kredi hareketlerini tarih aralığıyla takip et. Eski test kayıtları bu defterden ayrıştırıldı."
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Defter güvenli modda açıldı. Credit ledger migration eksik olabilir; Sistem Sağlığı ve Kayıtlar ekranından kontrol et.
        </div>
      ) : null}
      <CreditRangeControls activeRange={range} />
      <div className="grid gap-3 md:grid-cols-4">
        <AdminMetricCard label="Verilen hak" value={data.summary.issued} note="Satın alma, iade, pozitif admin işlemi" />
        <AdminMetricCard label="Kullanılan hak" value={data.summary.used} note="Email verification kullanımları" />
        <AdminMetricCard label="Manuel düzenleme" value={data.summary.manualAdjustments} note="Admin kredi değişiklikleri" />
        <AdminMetricCard label="Satın alma" value={data.summary.purchases} note="Ödeme ile gelen kredi" />
      </div>

      {data.missingLedgerPayments.length > 0 ? (
        <div className="mt-4">
          <AdminSection
            title="Ödeme var, defter kaydı eksik"
            description="Bu ödeme kayıtları PAID görünüyor ama PURCHASE credit transaction satırı bulunamadı. Kredi teslimatını ve webhook logunu kontrol et."
          >
            <AdminTable>
              <table className="min-w-[960px] w-full divide-y divide-amber-200 text-sm">
                <thead className="bg-amber-50 text-left text-xs uppercase tracking-[0.16em] text-amber-700">
                  <tr>
                    <th className="px-4 py-3">Kullanıcı</th>
                    <th className="px-4 py-3">Ödeme</th>
                    <th className="px-4 py-3">Teslim edilen hak</th>
                    <th className="px-4 py-3">Mevcut bakiye</th>
                    <th className="px-4 py-3">Stripe session</th>
                    <th className="px-4 py-3">Tarih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {data.missingLedgerPayments.map((payment) => (
                    <tr key={payment.id} className="bg-amber-50/45">
                      <td className="px-4 py-3 font-semibold text-slate-950">{payment.user.email}</td>
                      <td className="px-4 py-3 font-semibold text-slate-950">{Number(payment.amount).toFixed(2)} {payment.currency.toUpperCase()}</td>
                      <td className="px-4 py-3 font-semibold text-amber-800">{payment.creditsDelivered}</td>
                      <td className="px-4 py-3 text-slate-700">{payment.user.creditBalance}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{payment.stripeCheckoutSessionId || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{formatAdminDate(payment.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTable>
          </AdminSection>
        </div>
      ) : null}

      <div className="mt-4">
        <AdminSection
          title="Kredi hareketleri"
          description={`${rangeLabel(data.range)} aralığı: ${formatAdminDate(data.rangeStart)} sonrası doğrulama hakkı hareketleri.`}
        >
          <div className="mb-3">
            <AdminPaginationControls basePath="/admin/credits" params={{ range }} pagination={data.pagination} />
          </div>
          <AdminTable>
            <table className="min-w-[1180px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kullanıcı</th>
                  <th className="px-4 py-3">Tip</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Bakiye</th>
                  <th className="px-4 py-3">Not</th>
                  <th className="px-4 py-3">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{tx.user.email}</td>
                    <td className="px-4 py-3 font-semibold text-blue-700">{transactionLabel(tx.type)}</td>
                    <td className={tx.amount >= 0 ? "px-4 py-3 font-semibold text-emerald-700" : "px-4 py-3 font-semibold text-rose-700"}>{tx.amount}</td>
                    <td className="px-4 py-3 text-slate-700">{tx.balanceAfter}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {renderCreditTransactionNote(tx)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatAdminDate(tx.createdAt)}</td>
                  </tr>
                ))}
                {data.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <p className="font-semibold text-slate-950">Henüz kredi hareketi yok.</p>
                      <p className="mt-2 text-sm text-slate-400">
                        Kullanıcılara admin panelinden kredi ekleyince, verification kullanımı veya refund/purchase işlemleri burada görünecek.
                      </p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </AdminTable>
          <div className="mt-3">
            <AdminPaginationControls basePath="/admin/credits" params={{ range }} pagination={data.pagination} />
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}

async function getSafeCreditsData(page: number, range: AdminCreditsRange) {
  try {
    return { data: await getAdminCreditsData({ page, range }), error: null };
  } catch (error) {
    console.error("[admin-page-failed]", {
      page: "/admin/credits",
      widget: "credits.ledger",
      error: error instanceof Error ? error.message : "Unknown credits error"
    });
    return {
      data: {
        range,
        rangeStart: new Date(),
        rangeEnd: null,
        transactions: [],
        missingLedgerPayments: [],
        pagination: {
          page: 1,
          pageSize: 25,
          total: 0,
          totalPages: 1,
          from: 0,
          to: 0,
          hasPrevious: false,
          hasNext: false
        },
        totals: [],
        summary: {
          issued: 0,
          used: 0,
          manualAdjustments: 0,
          purchases: 0
        }
      },
      error
    };
  }
}

const creditRanges: Array<{ value: AdminCreditsRange; label: string }> = [
  { value: "last7", label: "Son 7 gün" },
  { value: "today", label: "Bugün" },
  { value: "yesterday", label: "Dün" },
  { value: "last24", label: "Son 24 saat" },
  { value: "last30", label: "Son 30 gün" }
];

function CreditRangeControls({ activeRange }: { activeRange: AdminCreditsRange }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      {creditRanges.map((item) => (
        <Link
          key={item.value}
          href={item.value === "last7" ? "/admin/credits" : `/admin/credits?range=${item.value}`}
          className={
            activeRange === item.value
              ? "rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
              : "rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          }
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function rangeLabel(range: AdminCreditsRange) {
  return creditRanges.find((item) => item.value === range)?.label || "Son 7 gün";
}

function transactionLabel(type: string) {
  if (type === "PURCHASE") return "Satın alma";
  if (type === "USE") return "Doğrulama kullanımı";
  if (type === "REFUND") return "İade";
  if (type === "ADMIN_ADJUSTMENT") return "Admin düzenleme";
  if (type === "REFERRAL_REWARD") return "Partner ödülü";
  if (type === "FREE_TRIAL") return "Deneme";
  return type;
}

type CreditTransactionRow = Awaited<ReturnType<typeof getAdminCreditsData>>["transactions"][number];

function renderCreditTransactionNote(tx: CreditTransactionRow) {
  if (tx.verificationJob?.originalFilename) return tx.verificationJob.originalFilename;
  if (tx.verificationJob) return `${tx.verificationJob.uniqueEmails.toLocaleString()} email verification`;
  if (tx.payment) return `Payment ${Number(tx.payment.amount).toFixed(2)} ${tx.payment.currency.toUpperCase()}`;
  if (isLegacyPhotoCreditNote(tx.note)) return "Eski test kaydı";
  return tx.note || "-";
}

function isLegacyPhotoCreditNote(note?: string | null) {
  if (!note) return false;
  const normalized = note.toLowerCase();
  return [
    "hd-upscale",
    "ai-relight",
    "object-remover",
    "background",
    "photo",
    "clean export",
    "failed job refund"
  ].some((marker) => normalized.includes(marker));
}
