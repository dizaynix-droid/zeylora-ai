import type { EmailEventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  renderEmailTemplate,
  templateEventType,
  type EmailTemplateKey
} from "@/lib/email/templates";

type SendTransactionalEmailInput = {
  templateKey: EmailTemplateKey;
  to: string;
  userId?: string | null;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && getEmailFrom());
}

export function getEmailFrom() {
  return process.env.EMAIL_FROM || "Zeylora AI <support@zeylora.ai>";
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput) {
  const recipient = normalizeEmail(input.to);
  const eventType = templateEventType[input.templateKey] as EmailEventType;
  const idempotencyKey = input.idempotencyKey || `${input.templateKey}:${recipient}:${stablePayloadKey(input.payload)}`;
  const payloadJson = toJson({
    ...(input.payload || {}),
    recipient
  });

  const existing = await prisma.emailEvent.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true }
  }).catch(() => null);

  if (existing?.status === "SENT" || existing?.status === "PENDING") {
    console.info("[email] duplicate skipped", { templateKey: input.templateKey, eventId: existing.id });
    return { ok: true as const, skipped: true as const, eventId: existing.id };
  }

  const event = await prisma.emailEvent.upsert({
    where: { idempotencyKey },
    update: {
      status: "PENDING",
      errorMessage: null,
      payloadJson
    },
    create: {
      userId: input.userId || null,
      eventType,
      status: "PENDING",
      templateKey: input.templateKey,
      recipientEmail: recipient,
      provider: "resend",
      idempotencyKey,
      payloadJson
    },
    select: { id: true }
  });

  if (!isResendConfigured()) {
    await markEmailFailed(event.id, "Resend is not configured.");
    console.warn("[email-failed]", { templateKey: input.templateKey, reason: "missing_resend_env" });
    return { ok: false as const, eventId: event.id, error: "Resend is not configured." };
  }

  const rendered = renderEmailTemplate(input.templateKey, {
    ...(input.payload || {}),
    email: recipient,
    supportEmail: process.env.SUPPORT_EMAIL || "support@zeylora.ai"
  });

  console.info("[email-send]", { templateKey: input.templateKey, recipientDomain: recipient.split("@")[1] });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: getEmailFrom(),
        to: [recipient],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          "X-Zeylora-Email-Event": event.id
        }
      })
    });

    const body = await response.json().catch(() => ({} as ResendResponse)) as ResendResponse;

    if (!response.ok) {
      const message = body.message || `Resend request failed with ${response.status}`;
      await markEmailFailed(event.id, message);
      console.warn("[email-failed]", { templateKey: input.templateKey, status: response.status, message });
      return { ok: false as const, eventId: event.id, error: message };
    }

    await prisma.emailEvent.update({
      where: { id: event.id },
      data: {
        status: "SENT",
        providerMessageId: body.id || null,
        sentAt: new Date(),
        errorMessage: null
      }
    });

    return { ok: true as const, eventId: event.id, providerMessageId: body.id || null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Resend email error.";
    await markEmailFailed(event.id, message);
    console.warn("[email-failed]", { templateKey: input.templateKey, message });
    return { ok: false as const, eventId: event.id, error: message };
  }
}

async function markEmailFailed(id: string, errorMessage: string) {
  await prisma.emailEvent.update({
    where: { id },
    data: {
      status: "FAILED",
      errorMessage
    }
  }).catch(() => null);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function stablePayloadKey(payload?: Record<string, unknown>) {
  if (!payload) return "empty";
  return Buffer.from(JSON.stringify(payload)).toString("base64url").slice(0, 80);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
