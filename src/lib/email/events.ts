import { sendTransactionalEmail } from "@/lib/email/resend";
import type { EmailTemplateKey } from "@/lib/email/templates";

export type TransactionalEmailEvent =
  | "payment_successful"
  | "credits_added"
  | "verification_job_queued"
  | "verification_job_completed"
  | "verification_job_failed"
  | "password_reset"
  | "mfa_enabled"
  | "ticket_reply"
  | "failed_payment"
  | "welcome";

export type EmailEventInput = {
  userId?: string;
  recipientEmail: string;
  templateKey: EmailTemplateKey;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
};

export async function enqueueEmailEvent(input: EmailEventInput) {
  return sendTransactionalEmail({
    templateKey: input.templateKey,
    to: input.recipientEmail,
    userId: input.userId,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload
  });
}
