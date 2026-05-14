import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminSection } from "@/components/admin/admin-ui";
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
    <AppShell area="admin" title="Kullanım analizi" description="Tool kullanımı, kredi ekonomisi, provider split ve hata oranı.">
      <div className="grid gap-3 md:grid-cols-4">
        <AdminMetricCard label="Tamamlanan işlem" value={data.completedJobs} />
        <AdminMetricCard label="Hatalı işlem" value={data.failedJobs} />
        <AdminMetricCard label="Hata oranı" value={`${data.failureRate}%`} />
        <AdminMetricCard label="Kullanılan kredi" value={data.creditsUsed} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <AdminSection title="En çok kullanılan araçlar" description="Sadece kullanımı olan araçlar gösterilir; sıfır kullanımlı gelecek araçlar gizlenir.">
          <div className="grid gap-2">
            {data.topTools.map((item) => (
              <div key={item.toolId} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                <div>
                  <p className="font-black text-white">{item.tool?.name}</p>
                  <p className="text-xs text-slate-500">{item.tool?.slug} • {item.tool?.providerKey}</p>
                </div>
                <p className="text-2xl font-black text-cyan">{item._count._all}</p>
              </div>
            ))}
            {data.topTools.length === 0 ? <p className="text-sm text-slate-400">Henüz tool kullanımı yok.</p> : null}
          </div>
        </AdminSection>
        <AdminSection title="Sağlayıcı dağılımı" description="Sağlayıcı bazlı işlem dağılımı.">
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
