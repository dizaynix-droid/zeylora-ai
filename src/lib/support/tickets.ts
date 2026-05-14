import { ActorType, TicketCategory, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export const ticketCategories: Array<{ value: TicketCategory; label: string }> = [
  { value: "BILLING", label: "Billing" },
  { value: "CREDITS", label: "Credits" },
  { value: "CLEAN_EXPORT", label: "Clean Export" },
  { value: "FAILED_JOB", label: "Failed Job" },
  { value: "AI_RESULT_QUALITY", label: "AI Result Quality" },
  { value: "ACCOUNT_ACCESS", label: "Account Access" },
  { value: "BUG_REPORT", label: "Bug Report" },
  { value: "OTHER", label: "Other" }
];

export const ticketStatuses: Array<{ value: TicketStatus; label: string }> = [
  { value: "OPEN", label: "Open" },
  { value: "ANSWERED", label: "Answered" },
  { value: "CLOSED", label: "Closed" }
];

export function sanitizeTicketText(value: string, maxLength: number) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim()
    .slice(0, maxLength);
}

export async function listUserTickets(userId: string) {
  return prisma.ticket.findMany({
    where: { userId, deletedAt: null },
    orderBy: { lastMessageAt: "desc" },
    take: 25,
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      aiJobId: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: 6,
        select: {
          id: true,
          actorType: true,
          body: true,
          createdAt: true
        }
      }
    }
  });
}

export async function listAdminTickets(input: {
  status?: string;
  category?: string;
  user?: string;
}) {
  const status = isTicketStatus(input.status) ? input.status : undefined;
  const category = isTicketCategory(input.category) ? input.category : undefined;
  const userQuery = input.user?.trim();

  return prisma.ticket.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(userQuery
        ? {
            user: {
              email: {
                contains: userQuery,
                mode: "insensitive"
              }
            }
          }
        : {})
    },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      aiJobId: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
      user: { select: { id: true, email: true, creditBalance: true } },
      aiJob: {
        select: {
          id: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          tool: { select: { name: true, slug: true } }
        }
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 8,
        select: {
          id: true,
          actorType: true,
          body: true,
          createdAt: true,
          user: { select: { email: true } }
        }
      }
    }
  });
}

export async function createTicketMessage(input: {
  ticketId: string;
  userId: string | null;
  actorType: ActorType;
  body: string;
  nextStatus: TicketStatus;
}) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const message = await tx.ticketMessage.create({
      data: {
        ticketId: input.ticketId,
        userId: input.userId,
        actorType: input.actorType,
        body: input.body
      }
    });

    await tx.ticket.update({
      where: { id: input.ticketId },
      data: {
        status: input.nextStatus,
        lastMessageAt: now,
        closedAt: input.nextStatus === "CLOSED" ? now : null
      }
    });

    return message;
  });
}

export function isTicketCategory(value: unknown): value is TicketCategory {
  return typeof value === "string" && ticketCategories.some((category) => category.value === value);
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && ticketStatuses.some((status) => status.value === value);
}
