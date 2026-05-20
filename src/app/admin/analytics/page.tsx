import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminSection, AdminTable } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminAnalyticsData } from "@/lib/admin/data";
import { getAffiliateAnalyticsData } from "@/lib/affiliate/data";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const dataStartedAt = adminPerfNow();
  const [data, affiliate] = await Promise.all([
    getAdminAnalyticsData(),
    getAffiliateAnalyticsData()
  ]);
  logAdminPerf("page./admin/analytics", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    topToolCount: data.topTools.length,
    providerCount: data.providerSplit.length
  });

  return (
    <AppShell area="admin" title="Davranış funnel analizi" description="Landing, liste yükleme, ön kontrol, pricing, checkout ve payment yolculuğunu takip et.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label="Günlük ziyaretçi" value={data.behavior.dailyVisitors} />
        <AdminMetricCard label="Liste yükleme" value={data.behavior.uploads} note={`${data.behavior.landingToUploadRate}% landing -> yükleme`} />
        <AdminMetricCard label="Ön kontrol" value={data.behavior.previews} note={`${data.behavior.uploadToPreviewRate}% yükleme -> ön kontrol`} />
        <AdminMetricCard label="Checkout start" value={data.behavior.checkoutStarts} />
        <AdminMetricCard label="Payment" value={data.behavior.payments} note={`${data.behavior.checkoutToPaymentRate}% checkout -> payment`} />
      </div>

      <div className="mt-4">
        <AdminSection title="Funnel akışı" description="Son 30 günde ana dönüşüm adımları ve bir önceki adıma göre dönüşüm.">
          <div className="grid gap-3 md:grid-cols-6">
            {data.behavior.funnelSteps.map((step, index) => (
              <div key={step.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{step.label}</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{step.count}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {index === 0 ? "Başlangıç" : `%${step.conversionFromPrevious} önceki adımdan`}
                </p>
              </div>
            ))}
          </div>
        </AdminSection>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Breakdown title="Ülkeler" rows={data.behavior.topCountries} />
        <Breakdown title="Cihazlar" rows={data.behavior.deviceBreakdown} />
        <Breakdown title="Trafik kaynakları" rows={data.behavior.topTrafficSources} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <AdminSection title="Günlük trend" description="Ziyaretçi, liste yükleme, ön kontrol, checkout ve payment trendleri.">
          <AdminTable>
            <table className="min-w-[760px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Gün</th>
                  <th className="px-4 py-3">Ziyaretçi</th>
                  <th className="px-4 py-3">Yükleme</th>
                  <th className="px-4 py-3">Ön kontrol</th>
                  <th className="px-4 py-3">Checkout</th>
                  <th className="px-4 py-3">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.behavior.dailyTrend.map((row) => (
                  <tr key={row.date}>
                    <td className="px-4 py-3 font-black text-slate-950">{row.date}</td>
                    <td className="px-4 py-3 text-slate-600">{row.visitors}</td>
                    <td className="px-4 py-3 text-slate-600">{row.uploads}</td>
                    <td className="px-4 py-3 text-slate-600">{row.previews}</td>
                    <td className="px-4 py-3 text-slate-600">{row.checkouts}</td>
                    <td className="px-4 py-3 text-slate-600">{row.payments}</td>
                  </tr>
                ))}
                {data.behavior.dailyTrend.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm font-bold text-slate-500" colSpan={6}>Henüz funnel event yok.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>

        <AdminSection title="Doğrulama ve teknik sağlık" description="Verification job tabanlı kullanım analizi korunur.">
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminMetricCard label="Tamamlanan işlem" value={data.completedJobs} />
              <AdminMetricCard label="Hatalı işlem" value={data.failedJobs} note={`Hata oranı %${data.failureRate}`} />
            </div>
            <Breakdown title="Funnel doğrulama kullanımı" rows={data.behavior.topTools} compact />
          </div>
        </AdminSection>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AdminSection title="Partner Program funnel" description="Referral tıklama, signup ve ödül dağıtım performansı.">
          <div className="grid gap-3 md:grid-cols-3">
            <AdminMetricCard label="Referral click" value={affiliate.clickCount} />
            <AdminMetricCard label="Referral signup" value={affiliate.signupCount} />
            <AdminMetricCard label="Reward grubu" value={affiliate.rewardGroups.length} />
          </div>
          <div className="mt-4 grid gap-2">
            {affiliate.rewardGroups.map((group) => (
              <div key={group.status} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-black text-slate-950">{group.status}</p>
                <p className="text-sm font-bold text-slate-600">{group._count._all} reward - {group._sum.rewardCredits ?? 0} kredi</p>
              </div>
            ))}
            {affiliate.rewardGroups.length === 0 ? <p className="text-sm font-bold text-slate-500">Henüz affiliate reward yok.</p> : null}
          </div>
        </AdminSection>

        <AdminSection title="Sağlayıcı ve sistem eventleri" description="Provider split ve teknik failure eventleri için operasyon görünümü.">
          <div className="grid gap-2">
            {data.providerSplit.map((provider) => (
              <div key={provider.providerKey} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <span className="font-black text-slate-950">{provider.providerKey}</span>
                <span className="text-2xl font-black text-blue-700">{provider._count._all}</span>
              </div>
            ))}
            {data.providerSplit.length === 0 ? <p className="text-sm text-slate-500">Sağlayıcı kullanımı yok.</p> : null}
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}

function Breakdown({
  title,
  rows,
  compact = false
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  compact?: boolean;
}) {
  return (
    <AdminSection title={title}>
      <div className="grid gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="font-black text-slate-950">{row.label}</p>
            <p className={compact ? "text-lg font-black text-blue-700" : "text-2xl font-black text-blue-700"}>{row.count}</p>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm font-bold text-slate-500">Henüz veri yok.</p> : null}
      </div>
    </AdminSection>
  );
}
