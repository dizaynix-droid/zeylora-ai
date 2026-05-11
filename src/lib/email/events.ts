export type TransactionalEmailEvent =
  | "payment_successful"
  | "credits_added"
  | "job_completed"
  | "job_failed_refunded"
  | "low_credits"
  | "welcome";

export type EmailEventInput = {
  userId?: string;
  eventType: TransactionalEmailEvent;
  templateKey: string;
  payload?: Record<string, unknown>;
};

export async function enqueueEmailEvent(input: EmailEventInput) {
  // Queue/provider integration belongs in a later phase; keep callers stable now.
  return {
    status: "pending" as const,
    ...input
  };
}
