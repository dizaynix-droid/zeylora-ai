import { AppShell } from "@/components/layout/app-shell";
import { AdminPaginationControls, AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requestWebhookReprocessAction } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminPackageReadinessData, getAdminPaymentDiagnosticsData, getAdminPaymentsData, normalizeAdminPage } from "@/lib/admin/data";
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
  const [packageReadiness, payments, diagnostics] = await Promise.all([
    getAdminPackageReadinessData(),
    getAdminPaymentsData({ page }),
    getAdminPaymentDiagnosticsData()
  ]);
  logAdminPerf("page./admin/payments", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    page,
    resultCount: payments.items.length,
    packageCount: packageReadiness.totalCount,
    webhookEvents: diagnostics.webhookEvents.length,
    diagnosticsFallback: Boolean(diagnostics.diagnosticsError)
  });
  const checklist = [
    { label: "Stripe secret key", ready: diagnostics.stripeSecretConfigured, note: "Checkout session için gerekli." },
    { label: "Stripe webhook secret", ready: diagnostics.stripeWebhookConfigured, note: "Webhook doğrulaması için gerekli." },
    { label: "NEXT_PUBLIC_SITE_URL", ready: diagnostics.siteUrlConfigured, note: "Success/cancel URL ve canonical domain için gerekli." },
    { label: "Aktif kredi paketleri", ready: packageReadiness.activeCount > 0, note: "Public paketlerin aktif olması gerekir." },
    { label: "Checkout endpoint", ready: diagnostics.checkoutEndpointReady, note: "/api/v1/billing/checkout" },
    { label: "Webhook endpoint", ready: diagnostics.webhookEndpointReady, note: "/api/v1/billing/webhook" },
    { label: "Duplicate koruması", ready: diagnostics.idempotencyReady && !diagnostics.duplicateSessionRisk, note: "Stripe event id ve payment status ile çift kredi önlenir." }
  ];

  return (
    <AppShell area="admin" title="Ödeme hazırlığı" description="Stripe checkout, webhook ve kredi teslimatı için operasyon kontrol listesi.">
      {!diagnostics.stripeSecretConfigured || !diagnostics.stripeWebhookConfigured || !diagnostics.siteUrlConfigured ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="font-semibold text-amber-800">Stripe henüz yapılandırılmamış</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Ödeme sayfası güvenli modda açıldı. Canlı checkout için `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` ve `NEXT_PUBLIC_SITE_URL`
            production environment içinde tanımlanmalı.
          </p>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DiagnosticCard label="Son webhook" value={diagnostics.lastWebhook?.eventType || "Yok"} note={diagnostics.lastWebhook ? `${diagnostics.lastWebhook.status} · ${formatAdminDate(diagnostics.lastWebhook.createdAt)}` : "Henüz Stripe event gelmedi"} tone={diagnostics.lastWebhook?.status === "failed" ? "bad" : "neutral"} />
        <DiagnosticCard label="Son başarılı ödeme" value={diagnostics.lastSuccessfulPayment ? `${diagnostics.lastSuccessfulPayment.amount.toString()} ${diagnostics.lastSuccessfulPayment.currency.toUpperCase()}` : "$0.00"} note={diagnostics.lastSuccessfulPayment?.user.email || "Başarılı ödeme yok"} tone={diagnostics.lastSuccessfulPayment ? "good" : "neutral"} />
        <DiagnosticCard label="Hatalı/iptal ödeme" value={diagnostics.failedPaymentCount} note="Son 30 gün FAILED + CANCELLED" tone={diagnostics.failedPaymentCount > 0 ? "warn" : "good"} />
        <DiagnosticCard label="Ledger eksik" value={diagnostics.missingLedgerPaymentCount} note="Son 30 gün PAID ama defter satırı yok" tone={diagnostics.missingLedgerPaymentCount > 0 ? "bad" : "good"} />
        <DiagnosticCard label="Idempotency" value={diagnostics.duplicateSessionRisk ? "Risk" : "Hazır"} note="Aynı session/event iki kez kredi yazmamalı" tone={diagnostics.duplicateSessionRisk ? "bad" : "good"} />
      </div>

      <AdminSection title="Ödeme kurulum kontrolü" description="Secret değerleri gösterilmez; sadece hazır/eksik durumu gösterilir.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {checklist.map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.note}</p>
                </div>
                <AdminStatusPill tone={item.ready ? "good" : "warn"}>{item.ready ? "Hazır" : "Eksik"}</AdminStatusPill>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>

      <div className="mt-4">
        <AdminSection title="Stripe webhook event kayıtları" description="Son 25 webhook. Secret/payload token gösterilmez; sadece operasyon durumu görünür.">
          <AdminTable>
            <table className="min-w-[1080px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Stripe event id</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Bağlantı</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Kontrol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {diagnostics.webhookEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{event.eventType}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{event.externalEventId || "-"}</td>
                    <td className="px-4 py-3"><WebhookStatus status={event.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{event.paymentId || event.userId || "-"}</td>
                    <td className="px-4 py-3 text-slate-400">{formatAdminDate(event.createdAt)}</td>
                    <td className="px-4 py-3">
                      {event.status === "failed" ? (
                        <form action={requestWebhookReprocessAction}>
                          <input type="hidden" name="webhookLogId" value={event.id} />
                          <button className="h-9 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800">
                            Reprocess iste
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-500">{event.errorMessage || "İşlem gerekmez"}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {diagnostics.webhookEvents.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm font-bold text-slate-400">Webhook kaydı yok.</td></tr>
                ) : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>
      </div>

      <div className="mt-4">
        <AdminSection
          title="Ödeme geçmişi"
          description="Checkout aktif olduğunda son ödeme ve kredi teslimatı kayıtları burada sayfalı olarak görünür."
        >
          <div className="mb-3">
            <AdminPaginationControls basePath="/admin/payments" pagination={payments.pagination} />
          </div>
          <AdminTable>
            <table className="min-w-[1180px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kullanıcı</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Kredi</th>
                  <th className="px-4 py-3">Stripe ref</th>
                  <th className="px-4 py-3">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payments.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{payment.user.email}</td>
                    <td className="px-4 py-3">
                      <PaymentStatus status={payment.status} />
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {payment.amount.toString()} {payment.currency.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{payment.creditsDelivered}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {payment.stripeCheckoutSessionId || payment.stripePaymentIntentId || payment.couponCode || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatAdminDate(payment.createdAt)}</td>
                  </tr>
                ))}
                {payments.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <p className="font-semibold text-slate-950">Henüz ödeme kaydı yok.</p>
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

function DiagnosticCard({ label, value, note, tone }: { label: string; value: string | number; note: string; tone: "good" | "bad" | "warn" | "neutral" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{note}</p>
        </div>
        <AdminStatusPill tone={tone}>{tone === "good" ? "İyi" : tone === "bad" ? "Risk" : tone === "warn" ? "Uyarı" : "Bilgi"}</AdminStatusPill>
      </div>
    </div>
  );
}

function WebhookStatus({ status }: { status: string }) {
  if (status === "processed") return <AdminStatusPill tone="good">İşlendi</AdminStatusPill>;
  if (status === "failed") return <AdminStatusPill tone="bad">Hatalı</AdminStatusPill>;
  if (status === "reprocess_requested") return <AdminStatusPill tone="warn">Tekrar işlem istendi</AdminStatusPill>;
  return <AdminStatusPill>{status}</AdminStatusPill>;
}

function PaymentStatus({ status }: { status: string }) {
  if (status === "PAID") return <AdminStatusPill tone="good">Ödendi</AdminStatusPill>;
  if (status === "FAILED") return <AdminStatusPill tone="bad">Hatalı</AdminStatusPill>;
  if (status === "CANCELLED") return <AdminStatusPill tone="bad">İptal</AdminStatusPill>;
  if (status === "REFUNDED" || status === "PARTIALLY_REFUNDED" || status === "PENDING") {
    return <AdminStatusPill tone="warn">{status === "PENDING" ? "Bekliyor" : "İade"}</AdminStatusPill>;
  }
  return <AdminStatusPill>{status}</AdminStatusPill>;
}
