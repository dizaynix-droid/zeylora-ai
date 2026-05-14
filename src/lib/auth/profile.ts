import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";

export async function syncSupabaseUserProfile(user: SupabaseUser) {
  if (!user.email) return null;

  const name = getDisplayName(user);
  const existingById = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      creditBalance: true,
      freeTrialClaimed: true,
      status: true,
      deletedAt: true
    }
  });

  if (existingById) {
    if (!needsUserSync(existingById, user.email, name)) return existingById;

    return prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.email,
        name,
        status: "ACTIVE",
        deletedAt: null
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        creditBalance: true,
        freeTrialClaimed: true,
        status: true,
        deletedAt: true
      }
    });
  }

  return prisma.user.upsert({
    where: { email: user.email },
    update: {
      name,
      status: "ACTIVE",
      deletedAt: null
    },
    create: {
      id: user.id,
      email: user.email,
      name,
      role: "USER",
      status: "ACTIVE"
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      creditBalance: true,
      freeTrialClaimed: true,
      status: true,
      deletedAt: true
    }
  });
}

function needsUserSync(
  user: { deletedAt: Date | null; email: string; name: string | null; status: string },
  email: string,
  name: string | null
) {
  return user.email !== email || user.name !== name || user.status !== "ACTIVE" || Boolean(user.deletedAt);
}

function getDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string }) {
  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;

  if (typeof fullName === "string" && fullName.trim()) return fullName;
  if (typeof name === "string" && name.trim()) return name;
  return user.email?.split("@")[0] || null;
}
