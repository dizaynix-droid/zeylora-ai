import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getDefaultFeatureFlags } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function AdminFeatureFlagsPage() {
  await requireAdmin();
  const flags = getDefaultFeatureFlags();
  const purpose: Record<string, string> = {
    upload_flow: "Public upload workspace and tool execution entrypoint.",
    credit_checkout: "Credit pack checkout activation switch.",
    clean_export: "Paid clean export rollout hook.",
    admin_experiments: "Internal A/B testing and admin experiments.",
    blog: "Public SEO blog visibility."
  };
  const mergedFlags = [
    ...flags,
    ...(flags.some((flag) => flag.key === "clean_export") ? [] : [{ key: "clean_export", enabled: true }])
  ];

  return (
    <AppShell area="admin" title="Özellik bayrakları" description="Araç, fiyatlama, dil ve deney kontrolleri için temel görünüm.">
      <AdminSection title="Feature flags" description="Bu liste sonraki fazda DB-backed editöre dönüşecek. Şimdilik güvenli read-only görünüm.">
        <div className="grid gap-3 md:grid-cols-2">
          {mergedFlags.map((flag) => (
            <div key={flag.key} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="font-black text-white">{flag.key}</p>
                <p className="mt-1 text-sm text-slate-400">{purpose[flag.key] || "Feature control."}</p>
              </div>
              <div>
                <AdminStatusPill tone={flag.enabled ? "good" : "neutral"}>{flag.enabled ? "Enabled" : "Disabled"}</AdminStatusPill>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>
    </AppShell>
  );
}
