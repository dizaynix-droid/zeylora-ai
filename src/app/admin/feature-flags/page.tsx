import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getDefaultFeatureFlags } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function AdminFeatureFlagsPage() {
  await requireAdmin();
  const flags = getDefaultFeatureFlags();
  const purpose: Record<string, string> = {
    upload_flow: "Public liste yükleme ve paste email giriş akışı.",
    credit_checkout: "Doğrulama paketi checkout aktivasyon anahtarı.",
    clean_export: "Doğrulama sonucu CSV export anahtarı.",
    admin_experiments: "Internal A/B test ve admin deneyleri.",
    blog: "Public SEO blog görünürlüğü."
  };
  const mergedFlags = [
    ...flags,
    ...(flags.some((flag) => flag.key === "clean_export") ? [] : [{ key: "clean_export", enabled: true }])
  ];

  return (
    <AppShell area="admin" title="Özellik bayrakları" description="Doğrulama akışı, checkout, export ve deney kontrolleri için temel görünüm.">
      <AdminSection title="Özellik bayrakları" description="Bu liste sonraki fazda DB-backed editöre dönüşecek. Şimdilik güvenli read-only görünüm.">
        <div className="grid gap-3 md:grid-cols-2">
          {mergedFlags.map((flag) => (
            <div key={flag.key} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="font-semibold text-slate-950">{flag.key}</p>
                <p className="mt-1 text-sm text-slate-400">{purpose[flag.key] || "Özellik kontrolü."}</p>
              </div>
              <div>
                <AdminStatusPill tone={flag.enabled ? "good" : "neutral"}>{flag.enabled ? "Aktif" : "Pasif"}</AdminStatusPill>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>
    </AppShell>
  );
}
