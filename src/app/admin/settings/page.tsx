import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { businessFoundation } from "@/config/business";
import { previewProtectionStrategy } from "@/config/preview-protection";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();

  return (
    <AppShell area="admin" title="Lansman ayarları" description="Preview, export, abuse protection ve launch configuration görünümü.">
      <AdminSection title="Export settings" description="Bu alan sonraki fazda DB-backed SiteSetting editörüne dönüşecek.">
        <div className="grid gap-3 md:grid-cols-2">
          <Setting label="Free watermark" value={businessFoundation.exports.freeWatermarkEnabled ? "Enabled" : "Disabled"} />
          <Setting label="Paid export" value={businessFoundation.exports.paidExportMode} />
          <Setting label="Credit enforcement" value={businessFoundation.credits.enforcementEnabled ? "Enabled" : "Disabled"} />
          <Setting label="Preview protection" value={previewProtectionStrategy.mode} />
        </div>
      </AdminSection>
      <div className="mt-5">
        <AdminSection title="Abuse protection" description="In-memory guard launch için geçici; public traffic için Redis/Upstash önerilir.">
          <div className="grid gap-3 md:grid-cols-3">
            <Setting label="Upload limit" value={`${businessFoundation.abuseProtection.uploadMaxRequests}/min`} />
            <Setting label="Job limit" value={`${businessFoundation.abuseProtection.jobMaxRequests}/min`} />
            <Setting label="Cooldown" value={`${businessFoundation.abuseProtection.cooldownMs}ms`} />
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <div className="mt-3"><AdminStatusPill tone="neutral">{value}</AdminStatusPill></div>
    </div>
  );
}
