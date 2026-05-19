import { AppShell } from "@/components/layout/app-shell";
import { VerifyAction, VerifyBadge, VerifyPanel } from "@/components/verify-ui/core";
import { createSupportTicketAction, replyToTicketAction } from "@/lib/support/actions";
import { getCurrentUserFromSession } from "@/lib/auth/current-user";
import { listUserTickets, ticketCategories } from "@/lib/support/tickets";

export const dynamic = "force-dynamic";

export default async function DashboardSupportPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; error?: string; jobId?: string }>;
}) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return (
      <AppShell area="dashboard" title="Support" description="Sign in to create and view support tickets.">
        <VerifyPanel className="p-6">
          <VerifyAction href="/auth/sign-in?next=/dashboard/support">Sign in to continue</VerifyAction>
        </VerifyPanel>
      </AppShell>
    );
  }

  const [params, tickets] = await Promise.all([searchParams, listUserTickets(user.id)]);

  return (
    <AppShell area="dashboard" title="Support tickets" description="Create a ticket, track replies, and keep billing or verification-job support tied to your Zeylora account.">
      {params?.saved ? <Notice tone="good">Ticket saved. We will reply here in your dashboard.</Notice> : null}
      {params?.error ? <Notice tone="bad">Ticket could not be saved. Please check the fields and try again.</Notice> : null}

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <VerifyPanel className="p-5">
          <VerifyBadge tone="blue">New support request</VerifyBadge>
          <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">Create ticket</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">For billing, verification credits, failed jobs, CSV exports, account access, or deliverability report questions.</p>
          <form action={createSupportTicketAction} className="mt-5 grid gap-3">
            <select name="category" className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
              {ticketCategories.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
            <input name="subject" required minLength={3} maxLength={160} placeholder="Subject" className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            <input name="aiJobId" defaultValue={params?.jobId || ""} placeholder="Related verification job ID (optional)" className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            <textarea name="message" required minLength={5} rows={7} placeholder="Tell us what happened." className="rounded-md border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            <button className="h-11 rounded-md bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700">Create ticket</button>
          </form>
        </VerifyPanel>

        <div className="grid gap-4">
          {tickets.length ? tickets.map((ticket) => (
            <VerifyPanel key={ticket.id} className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-950">{ticket.subject}</h3>
                    <TicketPill>{ticket.status}</TicketPill>
                    <TicketPill>{ticket.category.replaceAll("_", " ")}</TicketPill>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">Last reply {formatDate(ticket.lastMessageAt)} {ticket.aiJobId ? `• Job ${ticket.aiJobId}` : ""}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {ticket.messages.map((message) => (
                  <div key={message.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">{message.actorType}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.body}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDate(message.createdAt)}</p>
                  </div>
                ))}
              </div>
              {ticket.status !== "CLOSED" ? (
                <form action={replyToTicketAction} className="mt-4 grid gap-2">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <textarea name="message" rows={3} required placeholder="Reply to this ticket" className="rounded-md border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                  <button className="h-10 w-fit rounded-md border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">Send reply</button>
                </form>
              ) : null}
            </VerifyPanel>
          )) : (
            <VerifyPanel className="p-8 text-center">
              <h2 className="text-xl font-semibold text-slate-950">No tickets yet</h2>
              <p className="mt-2 text-sm text-slate-500">Create a ticket when you need help with verification credits, CSV exports, jobs, or account access.</p>
            </VerifyPanel>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Notice({ children, tone }: { children: string; tone: "good" | "bad" }) {
  return <div className={`mb-5 rounded-lg border p-4 text-sm font-semibold ${tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{children}</div>;
}

function TicketPill({ children }: { children: string }) {
  return <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600">{children}</span>;
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}
