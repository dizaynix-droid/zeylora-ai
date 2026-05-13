import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentSessionUser } from "@/lib/auth/current-user";

export type AdminSession = {
  id: string;
  email: string;
  role: "ADMIN";
  source: "role" | "email_whitelist";
};

export async function requireAdmin(): Promise<AdminSession> {
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser?.email) {
    redirect(`/auth/sign-in?next=${encodeURIComponent("/admin")}`);
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: sessionUser.id }, { email: sessionUser.email }],
      deletedAt: null
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true
    }
  });

  const normalizedEmail = sessionUser.email.toLowerCase();
  const isWhitelisted = getAdminEmailWhitelist().includes(normalizedEmail);

  if (user?.role === "ADMIN" && user.status === "ACTIVE") {
    return {
      id: user.id,
      email: user.email,
      role: "ADMIN",
      source: "role"
    };
  }

  if (isWhitelisted) {
    return {
      id: user?.id ?? sessionUser.id,
      email: user?.email ?? sessionUser.email,
      role: "ADMIN",
      source: "email_whitelist"
    };
  }

  redirect("/dashboard");
}

export function getAdminEmailWhitelist() {
  return (process.env.ZEYLORA_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
