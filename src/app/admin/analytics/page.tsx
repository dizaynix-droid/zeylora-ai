import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminSection } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminAnalyticsData } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requireAdmin();
  const data = await getAdminAnalyticsData();

  return (
    <AppShell area="admin" title="Kullanım analizi" description="Tool kullanımı, kredi ekonomisi, provider split ve hata oranı.">
      <div className="grid gap-3 md:grid-cols-4">
        <AdminMetricCard label="Completed jobs" value={data.completedJobs} />
        <AdminMetricCard label="Failed jobs" value={data.failedJobs} />
        <AdminMetricCard label="Failure rate" value={`${data.failureRate}%`} />
        <AdminMetricCard label="Credits used" value={data.creditsUsed} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <AdminSection title="Top tools" description="Sadece kullanımı olan araçlar gösterilir; zero-usage future tools gizlenir.">
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
        <AdminSection title="Provider split" description="Provider bazlı job dağılımı.">
          <div className="grid gap-2">
            {data.providerSplit.map((provider) => (
              <div key={provider.providerKey} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                <span className="font-black text-white">{provider.providerKey}</span>
                <span className="text-2xl font-black text-cyan">{provider._count._all}</span>
              </div>
            ))}
            {data.providerSplit.length === 0 ? <p className="text-sm text-slate-400">Provider usage yok.</p> : null}
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}
