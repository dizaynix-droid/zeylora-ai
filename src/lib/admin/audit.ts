import type { AdminSession } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function logAdminAction(input: {
  admin: AdminSession;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.adminLog.create({
      data: {
        adminUserId: input.admin.id,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadataJson: (input.metadata || {}) as Prisma.InputJsonObject
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[admin-audit-failed]", error instanceof Error ? error.message : error);
    }
  }
}
