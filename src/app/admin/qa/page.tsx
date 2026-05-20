import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminQaData } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminQaPage() {
  await requireAdmin();
  const data = await getAdminQaData();
  const tracking = (data.tracking && typeof data.tracking === "object" ? data.tracking : {}) as Record<string, unknown>;

  const qaSections = [
    {
      title: "Mobil QA",
      items: ["Homepage 390px", "Liste yükleme akışı", "Doğrulama sonucu", "Dashboard jobs pagination", "Verification credits page", "Tickets/support", "Settings"]
    },
    {
      title: "Ürün akışları",
      items: ["CSV/TXT upload smoke test", "Paste email smoke test", "Provider doğrulama", "Segment export", "Failed job support ticket", "Dashboard history"]
    },
    {
      title: "Ödeme ve kredi",
      items: ["Stripe checkout env", "Webhook env", "Active DB packages", "Credit transaction history", "Idempotency kontrolü"]
    },
    {
      title: "Launch compliance",
      items: ["Privacy", "Terms", "Refund policy", "Contact", "FAQ", "Sitemap", "Robots", "Canonical domain"]
    },
    {
      title: "Tracking",
      items: ["GA4 PageView", "Meta Pixel PageView", "Checkout started", "List parsed", "Verification completed", "Purchase only webhook sonrası"]
    },
    {
      title: "Provider",
      items: ["MillionVerifier key", "Secondary provider placeholder", "Failure rate", "Cost per verification", "Budget uyarıları"]
    }
  ];

  return (
    <AppShell area="admin" title="Launch QA checklist" description="Canlı domain ve reklam trafiği öncesi mobil, ödeme, tracking, provider ve legal kontrol paneli.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Status label="GA4" ok={Boolean(tracking.ga4MeasurementId)} />
        <Status label="Meta Pixel" ok={Boolean(tracking.metaPixelId)} />
        <Status label="TikTok" ok={Boolean(tracking.tiktokPixelId)} />
        <Status label="Pinterest" ok={Boolean(tracking.pinterestTagId)} />
        <Status label="Upload" ok={data.operations.uploadsEnabled} />
        <Status label="Verification" ok={data.operations.previewEnabled} />
        <Status label="CSV export" ok={data.operations.cleanExportsEnabled} />
        <Status label="Checkout" ok={data.operations.checkoutEnabled} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {qaSections.map((section) => (
          <AdminSection key={section.title} title={section.title} description="Operasyon sahibi bu listeyi canlı öncesi manuel işaretler.">
            <div className="grid gap-2">
              {section.items.map((item) => (
                <label key={item} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" className="size-4 accent-blue-600" />
                  {item}
                </label>
              ))}
            </div>
          </AdminSection>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AdminSection title="Provider monitor" description="Bugünkü provider sağlık özeti.">
          <AdminTable>
            <table className="min-w-[720px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Env</th>
                  <th className="px-4 py-3">Sağlık</th>
                  <th className="px-4 py-3">Bugün</th>
                  <th className="px-4 py-3">Hata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.providers.map((provider) => (
                  <tr key={provider.providerKey}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{provider.name}</td>
                    <td className="px-4 py-3"><AdminStatusPill tone={provider.configured ? "good" : "warn"}>{provider.configured ? "Hazır" : "Eksik"}</AdminStatusPill></td>
                    <td className="px-4 py-3">{provider.health}</td>
                    <td className="px-4 py-3 text-slate-700">{provider.jobsToday}</td>
                    <td className="px-4 py-3 text-rose-700">{provider.failedToday}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>

        <AdminSection title="Event debug" description="Server tarafında kaydedilen son analytics/operasyon eventleri.">
          <div className="grid gap-2">
            {data.recentEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-950">{event.action.replace("analytics.", "")}</p>
                <p className="mt-1 text-xs text-slate-400">{formatAdminDate(event.createdAt)}</p>
              </div>
            ))}
            {data.recentEvents.length === 0 ? <p className="text-sm font-bold text-slate-400">Henüz event kaydı yok.</p> : null}
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}

function Status({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-950">{label}</p>
        <AdminStatusPill tone={ok ? "good" : "warn"}>{ok ? "Hazır" : "Eksik"}</AdminStatusPill>
      </div>
    </div>
  );
}
