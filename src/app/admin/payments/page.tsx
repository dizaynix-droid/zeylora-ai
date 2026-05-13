import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminPricingData } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const packages = await getAdminPricingData();
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
    </AppShell>
  );
}
