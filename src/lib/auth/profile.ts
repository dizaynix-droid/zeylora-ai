import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { applyPendingReferralForUser, ensureAffiliateProfile } from "@/lib/affiliate/referrals";
import { ensureFreeTrialCredits } from "@/lib/credits/ledger";

type SyncedUserProfile = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  creditBalance: number;
  freeTrialClaimed: boolean;
  affiliateCode: string | null;
  referredByUserId: string | null;
  status: string;
  deletedAt: Date | null;
};

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
      affiliateCode: true,
      referredByUserId: true,
      status: true,
      deletedAt: true
    }
  });

  if (existingById) {
    if (!needsUserSync(existingById, user.email, name)) {
      const grantedUser = await applyFreeTrialIfEligible(existingById);
      await afterProfileSync(grantedUser);
      return grantedUser;
    }

    const updated = await prisma.user.update({
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
        affiliateCode: true,
        referredByUserId: true,
        status: true,
        deletedAt: true
      }
    });
    const grantedUser = await applyFreeTrialIfEligible(updated);
    await afterProfileSync(grantedUser);
    return grantedUser;
  }

  const upserted = await prisma.user.upsert({
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
      affiliateCode: true,
      referredByUserId: true,
      status: true,
      deletedAt: true
    }
  });
  const grantedUser = await applyFreeTrialIfEligible(upserted);
  await afterProfileSync(grantedUser);
  return grantedUser;
}

async function applyFreeTrialIfEligible<T extends SyncedUserProfile>(user: T): Promise<T> {
  if (user.freeTrialClaimed) return user;

  const grant = await ensureFreeTrialCredits(user.id).catch((error) => {
    console.error("[free-trial-grant-failed]", {
      userId: user.id,
      message: error instanceof Error ? error.message : String(error || "Unknown error"),
      stack: error instanceof Error ? error.stack : null
    });
    return null;
  });

  if (!grant || grant.skipped) return user;

  return {
    ...user,
    creditBalance: grant.balanceAfter,
    freeTrialClaimed: true
  };
}

async function afterProfileSync(user: { id: string; email: string; name: string | null; affiliateCode: string | null }) {
  await ensureAffiliateProfile(user).catch((error) => {
    if (process.env.NODE_ENV === "development") {
      console.warn("[affiliate-profile-sync-failed]", error instanceof Error ? error.message : error);
    }
  });
  await applyPendingReferralForUser(user.id).catch((error) => {
    if (process.env.NODE_ENV === "development") {
      console.warn("[affiliate-attribution-failed]", error instanceof Error ? error.message : error);
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
