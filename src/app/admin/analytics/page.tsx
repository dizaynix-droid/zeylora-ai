import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminSection, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminAnalyticsData } from "@/lib/admin/data";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const dataStartedAt = adminPerfNow();
  const data = await getAdminAnalyticsData();
  logAdminPerf("page./admin/analytics", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    topToolCount: data.topTools.length,
    providerCount: data.providerSplit.length
  });

  return (
    <AppShell area="admin" title="Davranış funnel analizi" description="Landing, upload, preview, pricing, checkout ve payment yolculuğunu takip et.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label="Günlük ziyaretçi" value={data.behavior.dailyVisitors} />
        <AdminMetricCard label="Upload" value={data.behavior.uploads} note={`${data.behavior.landingToUploadRate}% landing → upload`} />
        <AdminMetricCard label="Preview" value={data.behavior.previews} note={`${data.behavior.uploadToPreviewRate}% upload → preview`} />
        <AdminMetricCard label="Checkout start" value={data.behavior.checkoutStarts} />
        <AdminMetricCard label="Payment" value={data.behavior.payments} note={`${data.behavior.checkoutToPaymentRate}% checkout → payment`} />
      </div>

      <div className="mt-4">
        <AdminSection title="Funnel akışı" description="Son 30 günde ana dönüşüm adımları ve bir önceki adıma göre dönüşüm.">
          <div className="grid gap-3 md:grid-cols-6">
            {data.behavior.funnelSteps.map((step, index) => (
              <div key={step.key} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan">{step.label}</p>
                <p className="mt-2 text-3xl font-black text-white">{step.count}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">
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
        <AdminSection title="Günlük trend" description="Ziyaretçi, upload, preview, checkout ve payment trendleri.">
          <AdminTable>
            <table className="min-w-[760px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Gün</th>
                  <th className="px-4 py-3">Ziyaretçi</th>
                  <th className="px-4 py-3">Upload</th>
                  <th className="px-4 py-3">Preview</th>
                  <th className="px-4 py-3">Checkout</th>
                  <th className="px-4 py-3">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.behavior.dailyTrend.map((row) => (
                  <tr key={row.date}>
                    <td className="px-4 py-3 font-black text-white">{row.date}</td>
                    <td className="px-4 py-3 text-slate-300">{row.visitors}</td>
                    <td className="px-4 py-3 text-slate-300">{row.uploads}</td>
                    <td className="px-4 py-3 text-slate-300">{row.previews}</td>
                    <td className="px-4 py-3 text-slate-300">{row.checkouts}</td>
                    <td className="px-4 py-3 text-slate-300">{row.payments}</td>
                  </tr>
                ))}
                {data.behavior.dailyTrend.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm font-bold text-slate-400" colSpan={6}>Henüz funnel event yok.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>

        <AdminSection title="Tool ve teknik sağlık" description="Mevcut job tabanlı kullanım analizi korunur.">
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminMetricCard label="Tamamlanan işlem" value={data.completedJobs} />
              <AdminMetricCard label="Hatalı işlem" value={data.failedJobs} note={`Hata oranı %${data.failureRate}`} />
            </div>
            <Breakdown title="Funnel tool kullanımı" rows={data.behavior.topTools} compact />
          </div>
        </AdminSection>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AdminSection title="Kullanıcı yolculuğu" description="Son sessionlar: sayfa, tool, preview ve checkout adımları.">
          <div className="grid gap-3">
            {data.behavior.recentSessions.map((session) => (
              <div key={session.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black text-white">{session.userId ? `User ${session.userId.slice(0, 8)}` : `Anon ${session.id.slice(0, 8)}`}</p>
                    <p className="text-xs font-bold text-slate-500">{session.country || "country yok"} · {session.device || "device yok"} · {formatAdminDate(session.lastSeen)}</p>
                  </div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan">{session.events.length} event</p>
                </div>
                <div className="mt-3 grid gap-2">
                  {session.events.map((event) => (
                    <div key={`${session.id}-${event.event}-${event.createdAt.toISOString()}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-slate-300">
                      <span className="text-white">{event.event}</span>
                      {event.tool ? <span className="text-cyan"> · {event.tool}</span> : null}
                      {event.page ? <span className="text-slate-500"> · {event.page}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {data.behavior.recentSessions.length === 0 ? <p className="text-sm font-bold text-slate-400">Henüz session davranışı yok.</p> : null}
          </div>
        </AdminSection>

        <AdminSection title="Sağlayıcı ve sistem eventleri" description="Provider split ve teknik failure eventleri için operasyon görünümü.">
          <div className="grid gap-2">
            {data.providerSplit.map((provider) => (
              <div key={provider.providerKey} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                <span className="font-black text-white">{provider.providerKey}</span>
                <span className="text-2xl font-black text-cyan">{provider._count._all}</span>
              </div>
            ))}
            {data.providerSplit.length === 0 ? <p className="text-sm text-slate-400">Sağlayıcı kullanımı yok.</p> : null}
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
          <div key={row.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
            <p className="font-black text-white">{row.label}</p>
            <p className={compact ? "text-lg font-black text-cyan" : "text-2xl font-black text-cyan"}>{row.count}</p>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm font-bold text-slate-400">Henüz veri yok.</p> : null}
      </div>
    </AdminSection>
  );
}
