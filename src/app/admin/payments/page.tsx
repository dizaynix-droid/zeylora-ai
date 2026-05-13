import { AppShell } from "@/components/layout/app-shell";
import { AdminPaginationControls, AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminPaymentsData, getAdminPricingData, normalizeAdminPage } from "@/lib/admin/data";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const params = await searchParams;
  const page = normalizeAdminPage(params?.page);
  const dataStartedAt = adminPerfNow();
  const [packages, payments] = await Promise.all([getAdminPricingData(), getAdminPaymentsData({ page })]);
  logAdminPerf("page./admin/payments", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    page,
    resultCount: payments.items.length,
    packageCount: packages.length
  });
  const checklist = [
    { label: "Stripe secret key", ready: Boolean(process.env.STRIPE_SECRET_KEY), note: "Required for checkout sessions." },
    { label: "Stripe webhook secret", ready: Boolean(process.env.STRIPE_WEBHOOK_SECRET), note: "Required for verified webhook delivery." },
    { label: "Active credit packages", ready: packages.some((pack) => pack.status === "ACTIVE"), note: "Starter / Creator / Pro Seller should be active." },
    { label: "Checkout endpoint", ready: true, note: "/api/v1/payments/checkout" },
    { label: "Webhook endpoint", ready: true, note: "/api/v1/payments/stripe/webhook" }
  ];

  return (
    <AppShell area="admin" title="Ödeme hazırlığı" description="Stripe checkout, webhook ve kredi teslimatı için operasyon kontrol listesi.">
      <AdminSection title="Payment setup checklist" description="Secret değerleri gösterilmez; sadece configured/missing durumu gösterilir.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {checklist.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-white">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.note}</p>
                </div>
                <AdminStatusPill tone={item.ready ? "good" : "warn"}>{item.ready ? "Ready" : "Missing"}</AdminStatusPill>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>

      <div className="mt-4">
        <AdminSection
          title="Payment history"
          description="Checkout aktif olduğunda son ödeme ve kredi teslimatı kayıtları burada sayfalı olarak görünür."
        >
          <div className="mb-3">
            <AdminPaginationControls basePath="/admin/payments" pagination={payments.pagination} />
          </div>
          <AdminTable>
            <table className="min-w-[1180px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Kullanıcı</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Kredi</th>
                  <th className="px-4 py-3">Stripe ref</th>
                  <th className="px-4 py-3">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {payments.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 font-bold text-white">{payment.user.email}</td>
                    <td className="px-4 py-3">
                      <PaymentStatus status={payment.status} />
                    </td>
                    <td className="px-4 py-3 font-black text-white">
                      {payment.amount.toString()} {payment.currency.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{payment.creditsDelivered}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {payment.stripeCheckoutSessionId || payment.stripePaymentIntentId || payment.couponCode || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatAdminDate(payment.createdAt)}</td>
                  </tr>
                ))}
                {payments.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <p className="font-black text-white">Henüz ödeme kaydı yok.</p>
                      <p className="mt-2 text-sm text-slate-400">Checkout açıldığında başarılı, başarısız ve iade kayıtları burada listelenecek.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </AdminTable>
          <div className="mt-3">
            <AdminPaginationControls basePath="/admin/payments" pagination={payments.pagination} />
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}

function PaymentStatus({ status }: { status: string }) {
  if (status === "PAID") return <AdminStatusPill tone="good">{status}</AdminStatusPill>;
  if (status === "FAILED" || status === "CANCELLED") return <AdminStatusPill tone="bad">{status}</AdminStatusPill>;
  if (status === "REFUNDED" || status === "PARTIALLY_REFUNDED" || status === "PENDING") {
    return <AdminStatusPill tone="warn">{status}</AdminStatusPill>;
  }
  return <AdminStatusPill>{status}</AdminStatusPill>;
}
