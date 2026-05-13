import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminSection } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminOverviewData } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requireAdmin();
  const data = await getAdminOverviewData();

  return (
    <AppShell area="admin" title="Kullanım analizi" description="Tool kullanımı, kredi ekonomisi ve hata oranı için ilk dashboard.">
      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Completed jobs" value={data.metrics.completedJobs} />
        <AdminMetricCard label="Failed jobs" value={data.metrics.failedJobs} />
        <AdminMetricCard label="Credits used" value={data.metrics.creditsUsed} />
      </div>
      <div className="mt-5">
        <AdminSection title="Tool economics" description="Detaylı revenue/cost dashboard sonraki fazda provider logs ve payments ile bağlanacak.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.toolEconomics.map((tool) => (
              <div key={tool.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-black text-white">{tool.name}</p>
                <p className="mt-2 text-sm text-slate-400">{tool.creditCost} credits • {tool.providerKey}</p>
                <p className="mt-3 text-2xl font-black text-cyan">{"_count" in tool ? tool._count.jobs : 0}</p>
              </div>
            ))}
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}
