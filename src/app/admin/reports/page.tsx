import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { deleteBusinessExpenseAction, upsertBusinessExpenseAction } from "@/lib/admin/actions";
import { expenseCategoryLabels, getAdminReportsData } from "@/lib/admin/data";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

type ReportsSearchParams = {
  range?: string;
  group?: string;
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

const groupOptions = [
  ["daily", "Günlük"],
  ["weekly", "Haftalık"],
  ["monthly", "Aylık"]
] as const;

export default async function AdminReportsPage({
  searchParams
}: {
  searchParams?: Promise<ReportsSearchParams>;
}) {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const params = await searchParams;
  const dataStartedAt = adminPerfNow();
  const data = await getAdminReportsData({
    range: params?.range,
    group: params?.group,
    from: params?.from,
    to: params?.to,
    expenseCategory: params?.expenseCategory
  });
  logAdminPerf("page./admin/reports", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    range: data.range,
    grouping: data.grouping,
    expenses: data.expenses.length,
    toolUsage: data.toolUsage.length
  });

  return (
    <AppShell
      area="admin"
      title="İş raporları"
      description="Gelir, sağlayıcı maliyeti, reklam/SEO giderleri ve net kârı günlük, haftalık veya aylık takip et."
    >
      {params?.saved ? <Notice tone="good">Kaydedildi: {decodeURIComponent(params.saved)}</Notice> : null}
      {params?.deleted ? <Notice tone="warn">Gider silindi: {decodeURIComponent(params.deleted)}</Notice> : null}
      {params?.error ? <Notice tone="bad">İşlem tamamlanamadı. Alanları kontrol edip tekrar deneyin.</Notice> : null}

      <AdminSection title="Filtreler" description={`${formatAdminDate(data.start)} - ${formatAdminDate(data.end)} aralığı gösteriliyor.`}>
        <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Select name="range" defaultValue={data.range} options={rangeOptions} />
          <Select name="group" defaultValue={data.grouping} options={groupOptions} />
          <input name="from" type="date" defaultValue={params?.from || ""} className={inputClass} />
          <input name="to" type="date" defaultValue={params?.to || ""} className={inputClass} />
          <select name="expenseCategory" defaultValue={data.expenseCategory || ""} className={inputClass}>
            <option value="">Tüm giderler</option>
            {Object.entries(expenseCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button className="h-11 rounded-full bg-cyan px-5 text-sm font-black text-ink transition hover:bg-cyan/90 xl:col-span-2">
            Raporu güncelle
          </button>
        </form>
      </AdminSection>

      {data.summary.missingActiveCostTargets.length ? (
        <div className="mt-4 rounded-2xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm font-bold text-amber">
          Aktif email verification provider maliyeti eksik: {data.summary.missingActiveCostTargets.map((item) => `${item.name} (${item.providerName})`).join(", ")}.
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <AdminMetricCard label="Toplam gelir" value={formatCurrency(data.summary.revenue)} note={`${data.summary.paymentCount} başarılı ödeme`} />
        <AdminMetricCard label="Satılan kredi" value={data.summary.creditsSold} note="Başarılı ödeme ile teslim edilen kredi" />
        <AdminMetricCard label="Kullanılan kredi" value={data.summary.creditsUsed} note="Email verification harcamaları" />
        <AdminMetricCard label="Sağlayıcı maliyeti" value={formatCurrency(data.summary.providerCost)} note="Tamamlanan verification job tahmini maliyeti" />
        <AdminMetricCard label="Manuel gider" value={formatCurrency(data.summary.manualExpenses)} note="Reklam, SEO, domain, yazılım vb." />
        <AdminMetricCard label="Net kâr" value={formatCurrency(data.summary.netProfit)} note={`Marj: ${data.summary.profitMargin === null ? "-" : `${data.summary.profitMargin.toFixed(1)}%`}`} />
        <AdminMetricCard label="Brüt kâr" value={formatCurrency(data.summary.grossProfit)} note="Gelir - sağlayıcı maliyeti" />
        <AdminMetricCard label="İade tutarı" value={formatCurrency(data.summary.refundAmount)} note={`${data.summary.refundCount} iade kaydı`} />
        <AdminMetricCard label="Hatalı doğrulama" value={data.summary.failedJobCount} note="Provider/job hata takibi" />
        <AdminMetricCard label="Ort. doğrulama maliyeti" value={data.summary.costPerCleanExport === null ? "-" : formatCurrency(data.summary.costPerCleanExport)} note="Tahmini maliyet / verification job" />
        <AdminMetricCard label="Snapshot maliyet" value={formatCurrency(data.summary.snapshotProviderCost)} note="Job tamamlandığı andaki mühürlü maliyet" />
        <AdminMetricCard label="Snapshot kâr" value={formatCurrency(data.summary.estimatedProfit)} note="Kredi değeri - snapshot maliyet" />
        <AdminMetricCard label="Ort. kâr/job" value={data.summary.averageProfitPerExport === null ? "-" : formatCurrency(data.summary.averageProfitPerExport)} note="Tamamlanan verification job başına tahmini kâr" />
        <AdminMetricCard label="Ort. gelir/job" value={data.summary.averageRevenuePerExport === null ? "-" : formatCurrency(data.summary.averageRevenuePerExport)} note="Kredi değeri üzerinden tahmini gelir" />
        <AdminMetricCard label="Ort. provider/job" value={data.summary.averageProviderCostPerTool === null ? "-" : formatCurrency(data.summary.averageProviderCostPerTool)} note="Snapshot öncelikli ortalama maliyet" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <AdminSection title="Kâr/zarar akışı" description="Seçilen gruplamaya göre gelir, maliyet, gider ve net kâr.">
          <AdminTable>
            <table className="min-w-[820px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Dönem</th>
                  <th className="px-4 py-3">Gelir</th>
                  <th className="px-4 py-3">Sağlayıcı</th>
                  <th className="px-4 py-3">Gider</th>
                  <th className="px-4 py-3">Net kâr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.series.map((row) => (
                  <tr key={row.period}>
                    <td className="px-4 py-3 font-black text-white">{row.period}</td>
                    <td className="px-4 py-3 text-emerald">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-3 text-amber">{formatCurrency(row.providerCost)}</td>
                    <td className="px-4 py-3 text-rose-200">{formatCurrency(row.expenses)}</td>
                    <td className="px-4 py-3 font-black text-white">{formatCurrency(row.netProfit)}</td>
                  </tr>
                ))}
                {data.series.length === 0 ? <EmptyRow colSpan={5} message="Bu aralıkta veri yok." /> : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>

        <div id="expenses">
        <AdminSection title="Manuel gider ekle" description="Reklam, SEO, sağlayıcı, yazılım, domain ve hosting giderlerini buradan işle.">
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
            <input name="expenseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
            <textarea name="note" placeholder="Not (opsiyonel)" className="min-h-24 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan" />
            <button className="h-11 rounded-full bg-zeylora-brand text-sm font-black text-white shadow-glow transition hover:brightness-110">
              Gider ekle
            </button>
          </form>
        </AdminSection>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AdminSection title="Verification job maliyeti" description="Tamamlanan email verification işlerine göre tahmini provider maliyeti. Eski tool kayıtları varsa sadece geçmiş uyumluluk için görünür.">
          <AdminTable>
            <table className="min-w-[820px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">İş tipi</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Sağlayıcı</th>
                  <th className="px-4 py-3">İşlem</th>
                  <th className="px-4 py-3">Run maliyeti</th>
                  <th className="px-4 py-3">Kredi</th>
                  <th className="px-4 py-3">Maliyet</th>
                  <th className="px-4 py-3">Tahmini gelir</th>
                  <th className="px-4 py-3">Tahmini kâr</th>
                  <th className="px-4 py-3">Marj</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.toolUsage.map((row) => (
                  <tr key={row.slug}>
                    <td className="px-4 py-3">
                      <p className="font-black text-white">{row.name}</p>
                      {row.missingCost ? <p className="text-xs font-bold text-amber">Maliyet girilmemiş</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.qualityTier}</td>
                    <td className="px-4 py-3 text-slate-300">{row.provider}</td>
                    <td className="px-4 py-3 text-slate-300">{row.runs}</td>
                    <td className="px-4 py-3 text-slate-300">{formatCurrency(row.costPerRun)}</td>
                    <td className="px-4 py-3 text-slate-300">{row.credits}</td>
                    <td className="px-4 py-3 text-amber">{formatCurrency(row.estimatedCost)}</td>
                    <td className="px-4 py-3 text-emerald">{formatCurrency(row.estimatedRevenue)}</td>
                    <td className="px-4 py-3 font-black text-white">{formatCurrency(row.estimatedProfit)}</td>
                    <td className="px-4 py-3 text-slate-300">{row.marginPercent === null ? "-" : `${row.marginPercent.toFixed(1)}%`}</td>
                  </tr>
                ))}
                {data.toolUsage.length === 0 ? <EmptyRow colSpan={10} message="Tamamlanan işlem yok." /> : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>

        <AdminSection title="Email provider maliyetleri" description="Provider bazında tamamlanan/hatalı verification işi, tahmini maliyet ve bütçe placeholder bilgisi.">
          <AdminTable>
            <table className="min-w-[860px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Tamamlanan</th>
                  <th className="px-4 py-3">Hatalı</th>
                  <th className="px-4 py-3">Varsayılan maliyet</th>
                  <th className="px-4 py-3">Tahmini maliyet</th>
                  <th className="px-4 py-3">Bütçe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.providerUsage.map((row) => (
                  <tr key={row.provider}>
                    <td className="px-4 py-3">
                      <p className="font-black text-white">{row.provider}</p>
                      {row.missingCost ? <p className="text-xs font-bold text-amber">Maliyet eksik</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.completedJobs}</td>
                    <td className="px-4 py-3 text-rose-200">{row.failedJobs}</td>
                    <td className="px-4 py-3 text-slate-300">{formatCurrency(row.defaultCostPerRun)}</td>
                    <td className="px-4 py-3 text-amber">{formatCurrency(row.estimatedCost)}</td>
                    <td className="px-4 py-3 text-slate-400">
                      <p>Günlük {formatCurrency(row.dailyBudget)}</p>
                      <p>Aylık {formatCurrency(row.monthlyBudget)}</p>
                      <p className="text-xs">{row.budgetMode}</p>
                    </td>
                  </tr>
                ))}
                {data.providerUsage.length === 0 ? <EmptyRow colSpan={6} message="Provider kullanımı yok." /> : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AdminSection title="En kârlı araçlar" description="Snapshot gelir/kâr alanlarına göre en iyi araçlar.">
          <AdminTable>
            <table className="min-w-[680px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Araç</th>
                  <th className="px-4 py-3">İşlem</th>
                  <th className="px-4 py-3">Toplam kâr</th>
                  <th className="px-4 py-3">Ort. kâr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {[...data.toolUsage].sort((a, b) => b.estimatedProfit - a.estimatedProfit).slice(0, 5).map((row) => (
                  <tr key={row.slug}>
                    <td className="px-4 py-3 font-black text-white">{row.name}</td>
                    <td className="px-4 py-3 text-slate-300">{row.runs}</td>
                    <td className="px-4 py-3 text-emerald">{formatCurrency(row.estimatedProfit)}</td>
                    <td className="px-4 py-3 text-white">{formatCurrency(row.averageProfit)}</td>
                  </tr>
                ))}
                {data.toolUsage.length === 0 ? <EmptyRow colSpan={4} message="Kâr hesaplanacak işlem yok." /> : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>

        <AdminSection title="En düşük kârlı araçlar" description="Maliyeti yüksek veya kredi değeri düşük kalan araçları hızlı yakala.">
          <AdminTable>
            <table className="min-w-[680px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Araç</th>
                  <th className="px-4 py-3">İşlem</th>
                  <th className="px-4 py-3">Toplam kâr</th>
                  <th className="px-4 py-3">Ort. kâr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {[...data.toolUsage].sort((a, b) => a.estimatedProfit - b.estimatedProfit).slice(0, 5).map((row) => (
                  <tr key={row.slug}>
                    <td className="px-4 py-3 font-black text-white">{row.name}</td>
                    <td className="px-4 py-3 text-slate-300">{row.runs}</td>
                    <td className="px-4 py-3 text-rose-200">{formatCurrency(row.estimatedProfit)}</td>
                    <td className="px-4 py-3 text-white">{formatCurrency(row.averageProfit)}</td>
                  </tr>
                ))}
                {data.toolUsage.length === 0 ? <EmptyRow colSpan={4} message="Kâr hesaplanacak işlem yok." /> : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AdminSection title="Paket geliri" description="Başarılı ödemelerdeki paket metadata bilgisine göre gelir.">
          <AdminTable>
            <table className="min-w-[680px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Paket</th>
                  <th className="px-4 py-3">Ödeme</th>
                  <th className="px-4 py-3">Kredi</th>
                  <th className="px-4 py-3">Gelir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.packageRevenue.map((row) => (
                  <tr key={row.packageName}>
                    <td className="px-4 py-3 font-black text-white">{row.packageName}</td>
                    <td className="px-4 py-3 text-slate-300">{row.payments}</td>
                    <td className="px-4 py-3 text-slate-300">{row.credits}</td>
                    <td className="px-4 py-3 text-emerald">{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
                {data.packageRevenue.length === 0 ? <EmptyRow colSpan={4} message="Ödeme yok." /> : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AdminSection title="Gider kayıtları" description="Son 100 gider kaydı. Düzenleme ve silme soft-delete mantığıyla yapılır.">
          <AdminTable>
            <table className="min-w-[980px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Gider</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Kontrol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.expenses.map((expense) => (
                  <tr key={expense.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-black text-white">{expense.title}</p>
                      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">{expense.note || "Not yok"}</p>
                    </td>
                    <td className="px-4 py-3"><AdminStatusPill>{expenseCategoryLabels[expense.category]}</AdminStatusPill></td>
                    <td className="px-4 py-3 text-rose-200">{formatCurrency(Number(expense.amount), expense.currency)}</td>
                    <td className="px-4 py-3 text-slate-400">{formatAdminDate(expense.expenseDate)}</td>
                    <td className="px-4 py-3">
                      <form action={upsertBusinessExpenseAction} className="grid min-w-[320px] gap-2">
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <input name="title" defaultValue={expense.title} className={`${inputClass} h-9`} />
                        <div className="grid gap-2 sm:grid-cols-3">
                          <select name="category" defaultValue={expense.category} className={`${inputClass} h-9`}>
                            {Object.entries(expenseCategoryLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                          <input name="amount" type="number" min="0.01" step="0.01" defaultValue={Number(expense.amount)} className={`${inputClass} h-9`} />
                          <input name="currency" defaultValue={expense.currency} className={`${inputClass} h-9`} />
                        </div>
                        <input name="expenseDate" type="date" defaultValue={new Date(expense.expenseDate).toISOString().slice(0, 10)} className={`${inputClass} h-9`} />
                        <input name="note" defaultValue={expense.note || ""} placeholder="Not" className={`${inputClass} h-9`} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <button className="h-9 rounded-full bg-zeylora-brand text-xs font-black text-white">Kaydet</button>
                        </div>
                      </form>
                      <form action={deleteBusinessExpenseAction} className="mt-2">
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <button className="h-9 w-full rounded-full border border-rose-400/30 bg-rose-400/10 text-xs font-black text-rose-200">
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

        <div className="grid gap-4">
          <AdminSection title="En yüksek ödeme yapan kullanıcılar" description="Başarılı ödeme toplamına göre ilk 5 kullanıcı.">
            <AdminTable>
              <table className="min-w-[620px] w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Kullanıcı</th>
                    <th className="px-4 py-3">Ödeme</th>
                    <th className="px-4 py-3">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.topUsers.map((user) => (
                    <tr key={user.userId}>
                      <td className="px-4 py-3 font-black text-white">{user.email}</td>
                      <td className="px-4 py-3 text-slate-300">{user.paymentCount}</td>
                      <td className="px-4 py-3 text-emerald">{formatCurrency(user.amount)}</td>
                    </tr>
                  ))}
                  {data.topUsers.length === 0 ? <EmptyRow colSpan={3} message="Ödeme yapan kullanıcı yok." /> : null}
                </tbody>
              </table>
            </AdminTable>
          </AdminSection>

          <AdminSection title="Hatalı işler" description="Provider/tool bazında hata yoğunluğu.">
            <AdminTable>
              <table className="min-w-[620px] w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Araç</th>
                    <th className="px-4 py-3">Sağlayıcı</th>
                    <th className="px-4 py-3">Hata</th>
                    <th className="px-4 py-3">Son hata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.failedByTool.map((row) => (
                    <tr key={`${row.tool}-${row.provider}`}>
                      <td className="px-4 py-3 font-black text-white">{row.tool}</td>
                      <td className="px-4 py-3 text-slate-300">{row.provider}</td>
                      <td className="px-4 py-3 text-rose-200">{row.count}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-400">{row.lastError || "-"}</td>
                    </tr>
                  ))}
                  {data.failedByTool.length === 0 ? <EmptyRow colSpan={4} message="Hatalı işlem yok." /> : null}
                </tbody>
              </table>
            </AdminTable>
          </AdminSection>
        </div>
      </div>
    </AppShell>
  );
}

function Select({
  name,
  defaultValue,
  options
}: {
  name: string;
  defaultValue: string;
  options: readonly (readonly [string, string])[];
}) {
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
      <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-400">{message}</td>
    </tr>
  );
}

function Notice({ tone, children }: { tone: "good" | "bad" | "warn"; children: ReactNode }) {
  const styles = {
    good: "border-emerald/30 bg-emerald/10 text-emerald",
    bad: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    warn: "border-amber/30 bg-amber/10 text-amber"
  };

  return <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-black ${styles[tone]}`}>{children}</div>;
}

function formatCurrency(value: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2
  }).format(value);
}

const inputClass = "h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan";
