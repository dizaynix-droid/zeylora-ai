import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminPaginationControls, AdminSection, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminCreditsData, normalizeAdminPage } from "@/lib/admin/data";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

export default async function AdminCreditsPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const params = await searchParams;
  const page = normalizeAdminPage(params?.page);
  const dataStartedAt = adminPerfNow();
  const { data, error } = await getSafeCreditsData(page);
  logAdminPerf("page./admin/credits [admin-perf]", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    page,
    resultCount: data.transactions.length
  });

  return (
    <AppShell
      area="admin"
      title="Doğrulama hakkı defteri"
      description="Bugünkü satın alma, kullanım, iade ve admin kredi hareketleri. Eski foto test kayıtları bu defterden ayrıştırıldı."
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Defter güvenli modda açıldı. Credit ledger migration eksik olabilir; Sistem Sağlığı ve Kayıtlar ekranından kontrol et.
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-4">
        <AdminMetricCard label="Verilen hak" value={data.summary.issued} note="Satın alma, iade, pozitif admin işlemi" />
        <AdminMetricCard label="Kullanılan hak" value={data.summary.used} note="Email verification kullanımları" />
        <AdminMetricCard label="Manuel düzenleme" value={data.summary.manualAdjustments} note="Admin kredi değişiklikleri" />
        <AdminMetricCard label="Satın alma" value={data.summary.purchases} note="Ödeme ile gelen kredi" />
      </div>

      <div className="mt-4">
        <AdminSection
          title="Bugünkü kredi hareketleri"
          description={`Türkiye saatine göre ${formatAdminDate(data.rangeStart)} sonrası doğrulama hakkı hareketleri.`}
        >
          <div className="mb-3">
            <AdminPaginationControls basePath="/admin/credits" pagination={data.pagination} />
          </div>
          <AdminTable>
            <table className="min-w-[1180px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Kullanıcı</th>
                  <th className="px-4 py-3">Tip</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Bakiye</th>
                  <th className="px-4 py-3">Not</th>
                  <th className="px-4 py-3">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 font-bold text-white">{tx.user.email}</td>
                    <td className="px-4 py-3 text-cyan">{transactionLabel(tx.type)}</td>
                    <td className={tx.amount >= 0 ? "px-4 py-3 font-black text-emerald-200" : "px-4 py-3 font-black text-rose-200"}>{tx.amount}</td>
                    <td className="px-4 py-3 text-slate-300">{tx.balanceAfter}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {renderCreditTransactionNote(tx)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatAdminDate(tx.createdAt)}</td>
                  </tr>
                ))}
                {data.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <p className="font-black text-white">Henüz kredi hareketi yok.</p>
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
            <AdminPaginationControls basePath="/admin/credits" pagination={data.pagination} />
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}

async function getSafeCreditsData(page: number) {
  try {
    return { data: await getAdminCreditsData({ page }), error: null };
  } catch (error) {
    console.error("[admin-page-failed]", {
      page: "/admin/credits",
      widget: "credits.ledger",
      error: error instanceof Error ? error.message : "Unknown credits error"
    });
    return {
      data: {
        rangeStart: new Date(),
        transactions: [],
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
  if (isLegacyPhotoCreditNote(tx.note)) return "Eski foto test kaydı";
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
