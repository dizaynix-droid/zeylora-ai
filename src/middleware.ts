import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const maintenanceEnabled = process.env.MAINTENANCE_MODE === "true";

  if (
    shouldShowMaintenance(request.nextUrl.pathname, maintenanceEnabled)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "maintenance_mode"
      },
      { status: 503 }
    );
  }

  const response = await updateSession(request);
  const referralCode = normalizeReferralCode(request.nextUrl.searchParams.get("ref") || "");
  if (referralCode) {
    response.cookies.set("zeylora_ref", referralCode, {
      maxAge: 60 * 60 * 24 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]
};

function shouldShowMaintenance(pathname: string, enabled: boolean) {
  if (!enabled) return false;
  if (pathname.startsWith("/admin")) return false;
  return true;
}

function normalizeReferralCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
}
