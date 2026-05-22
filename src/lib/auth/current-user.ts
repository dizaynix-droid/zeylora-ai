import { prisma } from "@/lib/db";
import { syncSupabaseUserProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  creditBalance: number;
  freeTrialClaimed: boolean;
  referredByUserId: string | null;
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
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return null;
  }

  return {
    id: user.id,
    email: user.email
  };
}

export async function getCurrentAppUserForRead(): Promise<SessionUser | null> {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return null;
  }

  const appUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id: user.id },
        { email: user.email }
      ],
      deletedAt: null
    },
    select: {
      id: true,
      email: true
    }
  });

  return {
    id: appUser?.id ?? user.id,
    email: appUser?.email ?? user.email
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

  const prismaStartedAt = Date.now();
  const appUser = await syncSupabaseUserProfile(user);
  const prismaMs = Date.now() - prismaStartedAt;

  if (!appUser) {
    return {
      user: null,
      timing: {
        sessionMs,
        userLookupMs: Date.now() - lookupStartedAt,
        prismaMs
      }
    };
  }

  return {
    user: {
      id: appUser.id,
      email: appUser.email,
      role: appUser.role,
      creditBalance: appUser.creditBalance,
      freeTrialClaimed: appUser.freeTrialClaimed,
      referredByUserId: appUser.referredByUserId
    },
    timing: {
      sessionMs,
      userLookupMs: Date.now() - lookupStartedAt,
      prismaMs
    }
  };
}
