import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getMfaRedirectPath(nextPath: string) {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[auth/mfa] AAL check failed", error.message);
    }

    return null;
  }

  if (data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
    return `/auth/mfa?next=${encodeURIComponent(getSafeNextPath(nextPath))}`;
  }

  return null;
}

export async function requireMfaIfNeeded(nextPath: string) {
  const redirectPath = await getMfaRedirectPath(nextPath);

  if (redirectPath) {
    redirect(redirectPath);
  }
}

export function getSafeNextPath(nextPath: string | null | undefined) {
  if (!nextPath?.startsWith("/") || nextPath.startsWith("//")) {
    return "/dashboard";
  }

  return nextPath;
}
