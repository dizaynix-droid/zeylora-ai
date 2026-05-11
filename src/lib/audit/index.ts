export type AuditActorType = "admin" | "user" | "system";

export type AuditEventInput = {
  actorUserId?: string;
  actorType: AuditActorType;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
};

export async function createAuditEvent(input: AuditEventInput) {
  // Database write is wired in Phase 1 after Prisma generate/install.
  return {
    ...input,
    createdAt: new Date().toISOString()
  };
}
