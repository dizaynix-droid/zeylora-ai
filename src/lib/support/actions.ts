"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActorType, TicketStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { getCurrentUserFromSession } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { trackServerEvent } from "@/lib/analytics/server";
import { trackingEvents } from "@/config/tracking";
import {
  createTicketMessage,
  isTicketCategory,
  isTicketStatus,
  sanitizeTicketText
} from "@/lib/support/tickets";

export async function createSupportTicketAction(formData: FormData) {
  const user = await getCurrentUserFromSession();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent("/dashboard/support")}`);

  const category = String(formData.get("category") || "");
  const subject = sanitizeTicketText(String(formData.get("subject") || ""), 160);
  const message = sanitizeTicketText(String(formData.get("message") || ""), 4000);
  const verificationJobId = sanitizeTicketText(
    String(formData.get("verificationJobId") || formData.get("aiJobId") || ""),
    120
  );

  if (!isTicketCategory(category) || subject.length < 3 || message.length < 5) {
    redirect("/dashboard/support?error=invalid");
  }

  let relatedVerificationJobId: string | null = null;
  if (verificationJobId) {
    const job = await prisma.verificationJob.findFirst({
      where: { id: verificationJobId, userId: user.id, deletedAt: null },
      select: { id: true }
    });
    relatedVerificationJobId = job?.id ?? null;
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        userId: user.id,
        verificationJobId: relatedVerificationJobId,
        category,
        subject,
        status: "OPEN"
      },
      select: { id: true }
    });

    await tx.ticketMessage.create({
      data: {
        ticketId: created.id,
        userId: user.id,
        actorType: "USER",
        body: message
      }
    });

    return created;
  });

  trackServerEvent(trackingEvents.ticketCreated, {
    userId: user.id,
    ticketId: ticket.id,
    category,
    relatedJobId: relatedVerificationJobId
  });

  revalidatePath("/dashboard/support");
  redirect(`/dashboard/support?saved=${encodeURIComponent(ticket.id)}`);
}

export async function replyToTicketAction(formData: FormData) {
  const user = await getCurrentUserFromSession();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent("/dashboard/support")}`);

  const ticketId = sanitizeTicketText(String(formData.get("ticketId") || ""), 120);
  const message = sanitizeTicketText(String(formData.get("message") || ""), 4000);

  if (!ticketId || message.length < 2) redirect("/dashboard/support?error=invalid_reply");

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId: user.id, deletedAt: null },
    select: { id: true, status: true }
  });

  if (!ticket || ticket.status === "CLOSED") redirect("/dashboard/support?error=closed");

  await createTicketMessage({
    ticketId: ticket.id,
    userId: user.id,
    actorType: ActorType.USER,
    body: message,
    nextStatus: TicketStatus.OPEN
  });

  revalidatePath("/dashboard/support");
  redirect(`/dashboard/support?saved=${encodeURIComponent(ticket.id)}`);
}

export async function adminReplyToTicketAction(formData: FormData) {
  const admin = await requireAdmin();
  const ticketId = sanitizeTicketText(String(formData.get("ticketId") || ""), 120);
  const message = sanitizeTicketText(String(formData.get("message") || ""), 4000);

  if (!ticketId || message.length < 2) redirect("/admin/tickets?error=invalid_reply");

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, deletedAt: null },
    select: { id: true, subject: true, userId: true, user: { select: { email: true } } }
  });
  if (!ticket) redirect("/admin/tickets?error=missing");

  await createTicketMessage({
    ticketId: ticket.id,
    userId: admin.id,
    actorType: ActorType.ADMIN,
    body: message,
    nextStatus: TicketStatus.ANSWERED
  });

  await logAdminAction({
    admin,
    action: "ticket.reply",
    entityType: "Ticket",
    entityId: ticket.id
  });

  await sendTransactionalEmail({
    templateKey: "ticket_reply",
    to: ticket.user.email,
    userId: ticket.userId,
    idempotencyKey: `ticket-reply:${ticket.id}:${Date.now()}`,
    payload: {
      ticketSubject: ticket.subject,
      ticketMessage: message.slice(0, 1200)
    }
  });

  revalidatePath("/admin/tickets");
  redirect(`/admin/tickets?saved=${encodeURIComponent(ticket.id)}`);
}

export async function adminUpdateTicketStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const ticketId = sanitizeTicketText(String(formData.get("ticketId") || ""), 120);
  const status = String(formData.get("status") || "");

  if (!ticketId || !isTicketStatus(status)) redirect("/admin/tickets?error=invalid_status");

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status,
      closedAt: status === "CLOSED" ? new Date() : null
    }
  });

  await logAdminAction({
    admin,
    action: "ticket.status_update",
    entityType: "Ticket",
    entityId: ticketId,
    metadata: { status }
  });

  revalidatePath("/admin/tickets");
  redirect(`/admin/tickets?saved=${encodeURIComponent(ticketId)}`);
}
