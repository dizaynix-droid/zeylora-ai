import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getDefaultFeatureFlags } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function AdminFeatureFlagsPage() {
  await requireAdmin();
  const flags = getDefaultFeatureFlags();

  return (
    <AppShell area="admin" title="Özellik bayrakları" description="Araç, fiyatlama, dil ve deney kontrolleri için temel görünüm.">
      <AdminSection title="Feature flags" description="Bu liste sonraki fazda DB-backed editöre dönüşecek. Şimdilik güvenli read-only görünüm.">
        <div className="grid gap-3 md:grid-cols-2">
          {flags.map((flag) => (
            <div key={flag.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-black text-white">{flag.key}</p>
              <div className="mt-3">
                <AdminStatusPill tone={flag.enabled ? "good" : "neutral"}>{flag.enabled ? "Enabled" : "Disabled"}</AdminStatusPill>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>
    </AppShell>
  );
}
