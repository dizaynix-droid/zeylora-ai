import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export type AdminSession = {
  id: string;
  email: string;
  role: "ADMIN";
  source: "role" | "email_whitelist";
};

export async function requireAdmin(): Promise<AdminSession> {
  const admin = await resolveAdminSession();

  if (!admin) {
    redirect(`/auth/sign-in?next=${encodeURIComponent("/admin")}`);
  }

  return admin;
}

const resolveAdminSession = cache(async (): Promise<AdminSession | null> => {
  const startedAt = adminPerfNow();
  const supabase = await createClient();

  if (!supabase) {
    logAdminPerf("admin.auth", {
      totalMs: `${adminPerfNow() - startedAt}ms`,
      status: "missing_supabase"
    });
    return null;
  }

  const claimsStartedAt = adminPerfNow();
  const { data, error } = await supabase.auth.getClaims();
  const claimsMs = adminPerfNow() - claimsStartedAt;
  const claims = data?.claims;
  const email = typeof claims?.email === "string" ? claims.email : null;
  const id = typeof claims?.sub === "string" ? claims.sub : null;

  if (error || !email || !id) {
    logAdminPerf("admin.auth", {
      claimsMs: `${claimsMs}ms`,
      dbMs: "0ms",
      totalMs: `${adminPerfNow() - startedAt}ms`,
      status: "unauthenticated",
      error: error?.name
    });
    return null;
  }

  const normalizedEmail = email.toLowerCase();
  const isWhitelisted = getAdminEmailWhitelist().includes(normalizedEmail);

  if (isWhitelisted) {
    logAdminPerf("admin.auth", {
      claimsMs: `${claimsMs}ms`,
      dbMs: "0ms",
      totalMs: `${adminPerfNow() - startedAt}ms`,
      source: "email_whitelist",
      dbSkipped: true
    });

    return {
      id,
      email,
      role: "ADMIN",
      source: "email_whitelist"
    };
  }

  const dbStartedAt = adminPerfNow();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id }, { email }],
      deletedAt: null
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true
    }
  });
  const dbMs = adminPerfNow() - dbStartedAt;

  if (user?.role === "ADMIN" && user.status === "ACTIVE") {
    logAdminPerf("admin.auth", {
      claimsMs: `${claimsMs}ms`,
      dbMs: `${dbMs}ms`,
      totalMs: `${adminPerfNow() - startedAt}ms`,
      source: "role",
      dbSkipped: false
    });

    return {
      id: user.id,
      email: user.email,
      role: "ADMIN",
      source: "role"
    };
  }

  logAdminPerf("admin.auth", {
    claimsMs: `${claimsMs}ms`,
    dbMs: `${dbMs}ms`,
    totalMs: `${adminPerfNow() - startedAt}ms`,
    status: "forbidden",
    dbSkipped: false
  });
  redirect("/dashboard");
});

export function getAdminEmailWhitelist() {
  if (!adminEmailWhitelist) {
    adminEmailWhitelist = (process.env.ZEYLORA_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  }

  return adminEmailWhitelist;
}

let adminEmailWhitelist: string[] | null = null;
