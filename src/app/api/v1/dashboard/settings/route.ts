import { NextResponse } from "next/server";
import { getCurrentAppUserForRead } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type SettingsRequest = {
  name?: string;
};

export async function PATCH(request: Request) {
  const user = await getCurrentAppUserForRead();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SettingsRequest | null;
  const name = String(body?.name || "").trim().slice(0, 80);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: name || null
    },
    select: {
      email: true,
      name: true,
      createdAt: true,
      creditBalance: true
    }
  });

  return NextResponse.json({
    ok: true,
    user: {
      email: updated.email,
      name: updated.name,
      createdAt: updated.createdAt.toISOString(),
      creditBalance: updated.creditBalance
    }
  });
}
