import { Activity, CreditCard, Settings, ShieldCheck, Users, WandSparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminLinkButton, AdminMetricCard, AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminOverviewData } from "@/lib/admin/data";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  const admin = await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const dataStartedAt = adminPerfNow();
  const data = await getAdminOverviewData();
  logAdminPerf("page./admin", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    resultCount: data.recentJobs.length
  });

  return (
    <AppShell
      area="admin"
      title="Yönetim merkezi"
      description="Krediler, fiyatlama, kullanıcılar, araç ekonomisi ve lansman ayarları için güvenli operasyon paneli."
    >
      <div className="mb-4 rounded-2xl border border-cyan/20 bg-cyan/10 px-4 py-3 text-sm font-semibold text-cyan">
        Admin girişi: {admin.email} ({admin.source === "role" ? "rol" : "email whitelist"})
      </div>

      <div className="grid gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <AdminMetricCard label="Kullanıcı" value={data.metrics.totalUsers} note="Toplam kayıtlı hesap" />
        <AdminMetricCard label="İşlem" value={data.metrics.totalJobs} note="Tüm AI job kayıtları" />
        <AdminMetricCard label="Tamamlanan" value={data.metrics.completedJobs} note="Başarılı export akışı" />
        <AdminMetricCard label="Hatalı" value={data.metrics.failedJobs} note="İncelenecek job sayısı" />
        <AdminMetricCard label="Kredi Kullanımı" value={data.metrics.creditsUsed} note="Harcanan toplam kredi" />
        <AdminMetricCard label="Export" value={data.metrics.recentExports} note="Completed job adedi" />
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {[
          ["Add credits", "/admin/users?filter=with-credits"],
          ["View failed jobs", "/admin/jobs?status=failed"],
          ["Edit pricing", "/admin/pricing"],
          ["Tool status", "/admin/tools"],
          ["Payments setup", "/admin/payments"]
        ].map(([label, href]) => (
          <a
            key={label}
            href={href}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-white transition hover:border-cyan/30 hover:bg-cyan/10"
          >
            {label}
          </a>
        ))}
      </div>

      <div className="mt-4">
        <AdminSection
          title="Son işlemler"
          description="Job durumu, sağlayıcı, araç ve kullanıcı ilişkisini hızlıca kontrol et."
          action={<AdminLinkButton href="/admin/jobs">Tüm işlemler</AdminLinkButton>}
        >
          <AdminTable>
            <table className="min-w-[1180px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Araç</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Kullanıcı</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Kredi</th>
                  <th className="px-4 py-3">Hata</th>
                  <th className="px-4 py-3">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3 font-bold text-white">{job.tool.name}</td>
                    <td className="px-4 py-3"><JobStatusPill status={job.status} /></td>
                    <td className="px-4 py-3 text-slate-300">{job.user?.email || "-"}</td>
                    <td className="px-4 py-3 text-slate-300">{job.providerKey}</td>
                    <td className="px-4 py-3 text-slate-300">{job.creditCost}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-400">{job.errorMessage || "-"}</td>
                    <td className="px-4 py-3 text-slate-400">{formatAdminDate(job.createdAt)}</td>
                  </tr>
                ))}
                {data.recentJobs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Henüz işlem yok.</td></tr>
                ) : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>
      </div>

      <div className="mt-4">
        <AdminSection
          title="Operasyon modülleri"
          description="Phase 2 admin temeli. Her modül genişletilebilir şekilde ayrıldı."
        >
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {operationModules.map(({ title, description, Icon, href }) => (
              <a key={title} href={href} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
                <span className="grid size-10 place-items-center rounded-xl bg-cyan/10 text-cyan">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block font-black text-white">{title}</span>
                  <span className="block text-sm leading-5 text-slate-400">{description}</span>
                </span>
              </a>
            ))}
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}

const operationModules: Array<{
  title: string;
  description: string;
  Icon: LucideIcon;
  href: string;
}> = [
  { title: "Kullanıcılar", description: "Kredi bakiyesi, manuel düzenleme ve job özeti.", Icon: Users, href: "/admin/users" },
  { title: "Fiyatlama", description: "Kredi paketleri, bonuslar ve Stripe hazırlığı.", Icon: CreditCard, href: "/admin/pricing" },
  { title: "Araç ekonomisi", description: "Tool maliyetleri, aktif/pasif durum ve export modeli.", Icon: WandSparkles, href: "/admin/tools" },
  { title: "Lansman ayarları", description: "Preview, watermark, promo ve feature flag kontrolleri.", Icon: Settings, href: "/admin/settings" },
  { title: "Audit", description: "Admin aksiyonları ve sistem kayıtları.", Icon: ShieldCheck, href: "/admin/logs" },
  { title: "Analiz", description: "Kullanım, hata ve kredi ekonomisi özeti.", Icon: Activity, href: "/admin/analytics" }
];

function JobStatusPill({ status }: { status: string }) {
  if (status === "COMPLETED") return <AdminStatusPill tone="good">Completed</AdminStatusPill>;
  if (status === "FAILED" || status === "CANCELLED") return <AdminStatusPill tone="bad">{status}</AdminStatusPill>;
  if (status === "PROCESSING" || status === "PENDING") return <AdminStatusPill tone="warn">{status}</AdminStatusPill>;
  return <AdminStatusPill>{status}</AdminStatusPill>;
}
