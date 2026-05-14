import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { adminPerfNow, logAdminPerf, measureAdminQuery } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const dataStartedAt = adminPerfNow();
  const providerSettings = await measureAdminQuery(
    "providers.settings.list",
    prisma.providerSetting.findMany({
      orderBy: { providerKey: "asc" },
      select: {
        providerKey: true,
        name: true,
        status: true,
        monthlyBudgetLimit: true,
        monthlyBudgetUsed: true,
        budgetEnforcementMode: true
      }
    })
  );
  const dbProviderMap = new Map(providerSettings.map((provider) => [provider.providerKey, provider]));
  const runtimeProviders = [
    { key: "replicate", name: "Replicate", configured: Boolean(process.env.REPLICATE_API_TOKEN) },
    { key: "photoroom", name: "PhotoRoom", configured: Boolean(process.env.PHOTOROOM_API_KEY) },
    { key: "removebg", name: "remove.bg", configured: Boolean(process.env.REMOVEBG_API_KEY) }
  ];
  logAdminPerf("page./admin/providers", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    resultCount: providerSettings.length,
    runtimeProviderCount: runtimeProviders.length
  });

  return (
    <AppShell area="admin" title="Sağlayıcı ayarları" description="PhotoRoom, Replicate ve gelecekteki provider bütçe kontrolleri.">
      <AdminSection title="Çalışma zamanı sağlayıcıları" description="API key değerleri gösterilmez. Sadece hazır/eksik durumu ve bütçe bilgisi görünür.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {runtimeProviders.map((provider) => {
            const dbProvider = dbProviderMap.get(provider.key);
            return (
              <div key={provider.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{dbProvider?.name || provider.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{provider.key}</p>
                  </div>
                  <AdminStatusPill tone={provider.configured ? "good" : "warn"}>{provider.configured ? "Hazır" : "Eksik"}</AdminStatusPill>
                </div>
                <p className="mt-4 text-sm text-slate-300">
                  Kullanım ${Number(dbProvider?.monthlyBudgetUsed || 0).toFixed(2)}
                  {dbProvider?.monthlyBudgetLimit ? ` / $${Number(dbProvider.monthlyBudgetLimit).toFixed(2)}` : " / bütçe yok"}
                </p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  {dbProvider?.budgetEnforcementMode || "NOTIFY_ONLY"}
                </p>
              </div>
            );
          })}
        </div>
      </AdminSection>
    </AppShell>
  );
}
