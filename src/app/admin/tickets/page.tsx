import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { adminReplyToTicketAction, adminUpdateTicketStatusAction } from "@/lib/support/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminTickets, ticketCategories, ticketStatuses } from "@/lib/support/tickets";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage({
  searchParams
}: {
  searchParams?: Promise<{ status?: string; category?: string; user?: string; saved?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const tickets = await listAdminTickets({
    status: params?.status,
    category: params?.category,
    user: params?.user
  });

  return (
    <AppShell area="admin" title="Destek talepleri" description="Kullanıcı ticketları, job/export context ve hızlı admin yanıtları.">
      {params?.saved ? <Notice tone="good">Ticket güncellendi.</Notice> : null}
      {params?.error ? <Notice tone="bad">Ticket işlemi başarısız oldu.</Notice> : null}

      <AdminSection title="Filtreler" description="Son 50 ticket gösterilir. Durum, kategori veya kullanıcı email ile filtrele.">
        <form className="grid gap-3 md:grid-cols-4">
          <select name="status" defaultValue={params?.status || ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
            <option value="">Tüm durumlar</option>
            {ticketStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <select name="category" defaultValue={params?.category || ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
            <option value="">Tüm kategoriler</option>
            {ticketCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
          <input name="user" defaultValue={params?.user || ""} placeholder="Kullanıcı email" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          <button className="h-10 rounded-md bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700">Filtrele</button>
        </form>
      </AdminSection>

      <div className="mt-5 grid gap-4">
        {tickets.length ? tickets.map((ticket) => (
          <AdminSection
            key={ticket.id}
            title={ticket.subject}
            description={`${ticket.user.email} • ${ticket.category.replaceAll("_", " ")} • Son yanıt ${formatDate(ticket.lastMessageAt)}`}
            action={<AdminStatusPill tone={ticket.status === "CLOSED" ? "neutral" : ticket.status === "ANSWERED" ? "good" : "warn"}>{ticketStatusLabel(ticket.status)}</AdminStatusPill>}
          >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-3">
                {ticket.messages.map((message) => (
                  <div key={message.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">{message.actorType} {message.user?.email ? `• ${message.user.email}` : ""}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.body}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDate(message.createdAt)}</p>
                  </div>
                ))}
                <form action={adminReplyToTicketAction} className="grid gap-2">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <textarea name="message" rows={3} required placeholder="Admin yanıtı" className="rounded-md border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                  <button className="h-10 w-fit rounded-md border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">Admin yanıtını gönder</button>
                </form>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Bağlam</p>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  <p>Kullanıcı bakiyesi: <span className="font-semibold text-slate-950">{ticket.user.creditBalance}</span></p>
                  {ticket.verificationJob ? (
                    <>
                      <p>Job: <span className="font-mono text-xs text-slate-950">{ticket.verificationJob.id}</span></p>
                      <p>Liste: <span className="font-semibold text-slate-950">{ticket.verificationJob.originalFilename || "Yapıştırılan email listesi"}</span></p>
                      <p>Email: <span className="font-semibold text-slate-950">{ticket.verificationJob.uniqueEmails.toLocaleString()}</span></p>
                      <p>Durum: <span className="font-semibold text-slate-950">{ticket.verificationJob.status}</span></p>
                      {ticket.verificationJob.errorMessage ? <p className="line-clamp-3">Hata: {ticket.verificationJob.errorMessage}</p> : null}
                      <Link href={`/admin/verification-jobs?user=${encodeURIComponent(ticket.user.email)}`} className="font-semibold text-blue-700">İlgili doğrulama işlerini aç</Link>
                    </>
                  ) : ticket.aiJob ? (
                    <>
                      <p>Job: <span className="font-mono text-xs text-slate-950">{ticket.aiJob.id}</span></p>
                      <p>Eski bağlı işlem: <span className="font-semibold text-slate-950">{ticket.aiJob.tool.name}</span></p>
                      <p>Durum: <span className="font-semibold text-slate-950">{ticket.aiJob.status}</span></p>
                      {ticket.aiJob.errorMessage ? <p className="line-clamp-3">Hata: {ticket.aiJob.errorMessage}</p> : null}
                      <Link href={`/admin/verification-jobs?user=${encodeURIComponent(ticket.user.email)}`} className="font-semibold text-blue-700">İlgili doğrulama işlerini aç</Link>
                    </>
                  ) : <p>Bağlı job yok.</p>}
                </div>
                <form action={adminUpdateTicketStatusAction} className="mt-4 grid gap-2">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <select name="status" defaultValue={ticket.status} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                    {ticketStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                  <button className="h-10 rounded-md bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800">Durumu güncelle</button>
                </form>
              </div>
            </div>
          </AdminSection>
        )) : (
          <AdminSection title="Ticket yok" description="Bu filtrelere uygun destek ticketı yok.">
            <p className="text-sm text-slate-400">Yeni kullanıcı ticketları burada görünecek.</p>
          </AdminSection>
        )}
      </div>
    </AppShell>
  );
}

function Notice({ children, tone }: { children: string; tone: "good" | "bad" }) {
  return <div className={`mb-5 rounded-lg border p-4 text-sm font-semibold ${tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{children}</div>;
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("tr-TR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function ticketStatusLabel(status: string) {
  if (status === "OPEN") return "Açık";
  if (status === "ANSWERED") return "Yanıtlandı";
  if (status === "CLOSED") return "Kapalı";
  return status;
}
