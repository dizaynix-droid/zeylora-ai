import { Activity, CreditCard, Database, Settings, ShieldCheck, Users } from "lucide-react";
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
  const { data, error: adminLoadError } = await getSafeAdminOverviewData();
  logAdminPerf("page./admin", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    resultCount: data.recentJobs.length
  });

  return (
    <AppShell
      area="admin"
      title="İş kokpiti"
      description="Gelir, kâr, ödeme, kredi ve acil operasyon sinyalleri için owner dashboard."
    >
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
        Admin girişi: {admin.email} ({admin.source === "role" ? "rol" : "email whitelist"})
      </div>
      {adminLoadError ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Admin overview güvenli fallback modunda açıldı. Bazı opsiyonel widget verileri okunamadı; migration/env durumunu kontrol et.
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3 2xl:grid-cols-5">
        <AdminMetricCard label="Bugünkü gelir" value={formatCurrency(data.cockpit.today.revenue)} note={trendNote(data.cockpit.today.revenue, data.cockpit.yesterday.revenue)} />
        <AdminMetricCard label="Bugünkü ödeme" value={data.cockpit.today.paymentCount} note={`Dünkü gelir: ${formatCurrency(data.cockpit.yesterday.revenue)}`} />
        <AdminMetricCard label="Bugünkü net kâr" value={formatCurrency(data.cockpit.today.netProfit)} note="Gelir - provider maliyeti - gider" />
        <AdminMetricCard label="Bu ay gelir" value={formatCurrency(data.cockpit.thisMonth.revenue)} note={`Son 7 gün: ${formatCurrency(data.cockpit.last7.revenue)}`} />
        <AdminMetricCard label="Bu ay net kâr" value={formatCurrency(data.cockpit.thisMonth.netProfit)} note={`Son 30 gün: ${formatCurrency(data.cockpit.last30.revenue)}`} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3 2xl:grid-cols-5">
        <AdminMetricCard label="Bugün satılan kredi" value={data.cockpit.today.creditsSold} note="Başarılı ödemelerden" />
        <AdminMetricCard label="Bugün kullanılan kredi" value={data.cockpit.today.creditsUsed} note="Clean export kullanımı" />
        <AdminMetricCard label="Açık ticket" value={data.cockpit.openTickets} note="Owner yanıtı bekleyen talepler" />
        <AdminMetricCard label="Bugün hatalı iş" value={data.cockpit.failedJobsToday} note="İncelenmesi gereken job" />
        <AdminMetricCard label="Bugün clean export" value={data.cockpit.today.cleanExports} note="Kredi kesilen export sayısı" />
      </div>

      <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2 xl:grid-cols-3">
        {buildAlerts(data).map((alert) => (
          <a
            key={alert.href + alert.label}
            href={alert.href}
            className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${alert.tone === "bad" ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : alert.tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
          >
            {alert.label}
          </a>
        ))}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3 2xl:grid-cols-6">
        {[
          ["Raporları aç", "/admin/reports"],
          ["Fiyatları düzenle", "/admin/pricing"],
          ["Gider ekle", "/admin/reports#expenses"],
          ["Ticketları aç", "/admin/tickets"],
          ["Araç maliyetleri", "/admin/tools"],
          ["Ödeme ayarları", "/admin/payments"]
        ].map(([label, href]) => (
          <a
            key={label}
            href={href}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 transition hover:border-blue-200 hover:bg-blue-50"
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
            <table className="min-w-[1180px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Liste</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Kullanıcı</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Kredi</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Hata</th>
                  <th className="px-4 py-3">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3 font-bold text-slate-950">{job.originalFilename || job.id.slice(0, 8)}</td>
                    <td className="px-4 py-3"><JobStatusPill status={job.status} /></td>
                    <td className="px-4 py-3 text-slate-700">{job.user?.email || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{job.providerKey}</td>
                    <td className="px-4 py-3 text-slate-700">{job.creditsUsed || job.creditsReserved}</td>
                    <td className="px-4 py-3 text-slate-700">{job.uniqueEmails.toLocaleString()}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-400">{job.errorMessage || "-"}</td>
                    <td className="px-4 py-3 text-slate-400">{formatAdminDate(job.createdAt)}</td>
                  </tr>
                ))}
                {data.recentJobs.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Henüz işlem yok.</td></tr>
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
              <a key={title} href={href} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50">
                <span className="grid size-10 place-items-center rounded-md bg-blue-50 text-blue-700">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block font-semibold text-slate-950">{title}</span>
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
  { title: "Doğrulama ekonomisi", description: "Provider maliyetleri, kredi maliyeti ve verification modeli.", Icon: Database, href: "/admin/tools" },
  { title: "Lansman ayarları", description: "Preview, watermark, promo ve feature flag kontrolleri.", Icon: Settings, href: "/admin/settings" },
  { title: "Audit", description: "Admin aksiyonları ve sistem kayıtları.", Icon: ShieldCheck, href: "/admin/logs" },
  { title: "Raporlar", description: "Gelir, gider, sağlayıcı maliyeti ve kâr/zarar takibi.", Icon: Activity, href: "/admin/reports" }
];

function buildAlerts(data: Awaited<ReturnType<typeof getAdminOverviewData>>) {
  const alerts: Array<{ label: string; href: string; tone: "good" | "warn" | "bad" }> = [];

  if (data.cockpit.missingActiveCostTargets.length) {
    alerts.push({
      label: `${data.cockpit.missingActiveCostTargets.length} aktif araç/provider maliyeti eksik`,
      href: "/admin/tools",
      tone: "warn"
    });
  }
  if (data.cockpit.failedJobsToday > 0) {
    alerts.push({
      label: `${data.cockpit.failedJobsToday} hatalı job inceleme bekliyor`,
      href: "/admin/jobs?status=failed",
      tone: "bad"
    });
  }
  if (data.cockpit.openTickets > 0) {
    alerts.push({
      label: `${data.cockpit.openTickets} açık ticket var`,
      href: "/admin/tickets?status=OPEN",
      tone: "warn"
    });
  }
  if (!data.cockpit.operations.checkoutEnabled) {
    alerts.push({ label: "Checkout kapalı", href: "/admin/settings", tone: "warn" });
  }
  if (!data.cockpit.operations.uploadsEnabled) {
    alerts.push({ label: "Upload kapalı", href: "/admin/settings", tone: "bad" });
  }
  if (!data.cockpit.operations.previewEnabled) {
    alerts.push({ label: "Preview kapalı", href: "/admin/settings", tone: "bad" });
  }
  if (!data.cockpit.operations.cleanExportsEnabled) {
    alerts.push({ label: "Clean export kapalı", href: "/admin/settings", tone: "warn" });
  }
  if (data.cockpit.missingEnvProviders.length) {
    alerts.push({
      label: `${data.cockpit.missingEnvProviders.length} aktif provider ENV eksik`,
      href: "/admin/providers",
      tone: "bad"
    });
  }

  if (!alerts.length) {
    alerts.push({ label: "Acil operasyon uyarısı yok", href: "/admin/reports", tone: "good" });
  }

  return alerts;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function trendNote(today: number, yesterday: number) {
  if (today === 0 && yesterday === 0) return "Düne göre veri yok";
  if (yesterday === 0) return "Düne göre yeni gelir";
  const change = ((today - yesterday) / yesterday) * 100;
  return `${change >= 0 ? "Yukarı" : "Aşağı"} ${Math.abs(change).toFixed(1)}% vs dün`;
}

function JobStatusPill({ status }: { status: string }) {
  if (status === "COMPLETED") return <AdminStatusPill tone="good">Tamamlandı</AdminStatusPill>;
  if (status === "FAILED") return <AdminStatusPill tone="bad">Hatalı</AdminStatusPill>;
  if (status === "CANCELLED") return <AdminStatusPill tone="bad">İptal</AdminStatusPill>;
  if (status === "PROCESSING") return <AdminStatusPill tone="warn">İşleniyor</AdminStatusPill>;
  if (status === "PENDING") return <AdminStatusPill tone="warn">Bekliyor</AdminStatusPill>;
  return <AdminStatusPill>{status}</AdminStatusPill>;
}

async function getSafeAdminOverviewData(): Promise<{
  data: Awaited<ReturnType<typeof getAdminOverviewData>>;
  error: string | null;
}> {
  try {
    return { data: await getAdminOverviewData(), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown admin overview error";
    console.error("[admin-page-failed]", {
      page: "/admin",
      message,
      name: error instanceof Error ? error.name : "UnknownError"
    });

    return {
      data: buildFallbackAdminOverviewData(),
      error: message
    };
  }
}

function buildFallbackAdminOverviewData(): Awaited<ReturnType<typeof getAdminOverviewData>> {
  const emptyRange = {
    revenue: 0,
    paymentCount: 0,
    creditsSold: 0,
    creditsUsed: 0,
    cleanExports: 0,
    providerCost: 0,
    manualExpenses: 0,
    netProfit: 0
  };

  return {
    metrics: {
      totalUsers: 0,
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      failedJobsToday: 0,
      openTickets: 0,
      creditsUsed: 0,
      recentExports: 0
    },
    cockpit: {
      totalUsers: 0,
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      failedJobsToday: 0,
      pendingJobs: 0,
      openTickets: 0,
      today: emptyRange,
      yesterday: emptyRange,
      last7: emptyRange,
      last30: emptyRange,
      thisMonth: emptyRange,
      missingActiveCostTargets: [{ name: "Admin data", providerName: "fallback" }],
      missingEnvProviders: [],
      operations: {
        previewEnabled: true,
        cleanExportsEnabled: true,
        checkoutEnabled: true,
        uploadsEnabled: true,
        registrationEnabled: true,
        emailsEnabled: false,
        maintenanceMode: false,
        uploadMaxSizeMb: 10,
        guestPreviewPerMinute: 3,
        guestPreviewPerHour: 15,
        userJobsPerMinute: 10,
        userJobsPerDay: 100,
        estimatedCreditUsdValue: 0.01,
        supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || "support@zeylora.ai",
        billingEmail: process.env.SUPPORT_EMAIL || "support@zeylora.ai",
        brandName: process.env.NEXT_PUBLIC_BRAND_NAME || "Zeylora",
        defaultCurrency: "USD"
      }
    },
    recentJobs: []
  };
}
