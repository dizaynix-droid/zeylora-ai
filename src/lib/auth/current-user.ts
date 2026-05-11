import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  creditBalance: number;
  freeTrialClaimed: boolean;
};

export type SessionUser = {
  id: string;
  email: string;
};

export type AuthTiming = {
  sessionMs: number;
  userLookupMs: number;
  prismaMs: number;
};

export async function getCurrentUser(request: Request): Promise<AuthenticatedUser | null> {
  void request;
  return getCurrentUserFromSession();
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session?.user?.email) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email
  };
}

export async function getCurrentUserFromSession(): Promise<AuthenticatedUser | null> {
  const { user } = await getCurrentUserFromSessionWithTiming();
  return user;
}

export async function getCurrentUserFromSessionWithTiming(): Promise<{
  user: AuthenticatedUser | null;
  timing: AuthTiming;
}> {
  const lookupStartedAt = Date.now();
  const supabase = await createClient();
  const emptyTiming = { sessionMs: 0, userLookupMs: 0, prismaMs: 0 };

  if (!supabase) {
    return {
      user: null,
      timing: emptyTiming
    };
  }

  const sessionStartedAt = Date.now();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  const sessionMs = Date.now() - sessionStartedAt;

  if (error || !user?.email) {
    return {
      user: null,
      timing: {
        sessionMs,
        userLookupMs: Date.now() - lookupStartedAt,
        prismaMs: 0
      }
    };
  }

  const name = getDisplayName(user);
  const prismaStartedAt = Date.now();
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

  const appUser = existingById
    ? needsUserSync(existingById, user.email, name)
      ? await prisma.user.update({
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
            role: true,
            creditBalance: true,
            freeTrialClaimed: true
          }
        })
      : existingById
    : await prisma.user.upsert({
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
          role: true,
          creditBalance: true,
          freeTrialClaimed: true
        }
      });
  const prismaMs = Date.now() - prismaStartedAt;

  return {
    user: {
      id: appUser.id,
      email: appUser.email,
      role: appUser.role,
      creditBalance: appUser.creditBalance,
      freeTrialClaimed: appUser.freeTrialClaimed
    },
    timing: {
      sessionMs,
      userLookupMs: Date.now() - lookupStartedAt,
      prismaMs
    }
  };
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
