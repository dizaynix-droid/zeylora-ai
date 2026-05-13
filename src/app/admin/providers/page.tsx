import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  await requireAdmin();
  const providers = await prisma.providerSetting.findMany({
    orderBy: { providerKey: "asc" },
    select: {
      providerKey: true,
      name: true,
      status: true,
      monthlyBudgetLimit: true,
      monthlyBudgetUsed: true,
      budgetEnforcementMode: true
    }
  });

  return (
    <AppShell area="admin" title="Sağlayıcı ayarları" description="PhotoRoom, Replicate ve gelecekteki provider bütçe kontrolleri.">
      <AdminSection title="Provider budgets" description="API key değerleri gösterilmez. Bütçe ve pause/block politikaları burada izlenir.">
        <div className="grid gap-3 md:grid-cols-2">
          {providers.map((provider) => (
            <div key={provider.providerKey} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-white">{provider.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{provider.providerKey}</p>
                </div>
                <AdminStatusPill tone={provider.status === "ACTIVE" ? "good" : "neutral"}>{provider.status}</AdminStatusPill>
              </div>
              <p className="mt-4 text-sm text-slate-300">
                Used ${Number(provider.monthlyBudgetUsed).toFixed(2)}
                {provider.monthlyBudgetLimit ? ` / $${Number(provider.monthlyBudgetLimit).toFixed(2)}` : " / no limit"}
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{provider.budgetEnforcementMode}</p>
            </div>
          ))}
          {providers.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
              Provider ayarı henüz seed edilmemiş. Runtime env değerleri çalışmaya devam eder.
            </p>
          ) : null}
        </div>
      </AdminSection>
    </AppShell>
  );
}
