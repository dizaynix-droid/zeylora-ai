import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { FREE_TRIAL_DEVICE_COOKIE } from "@/config/free-trial";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const canonicalRedirect = getCanonicalRedirect(request);
  if (canonicalRedirect) {
    return canonicalRedirect;
  }

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
  if (!request.cookies.get(FREE_TRIAL_DEVICE_COOKIE)?.value) {
    response.cookies.set(FREE_TRIAL_DEVICE_COOKIE, crypto.randomUUID(), {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true
    });
  }

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

function getCanonicalRedirect(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() || "";
  if (host !== "zeylora-ai.vercel.app") return null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.zeylora.ai";
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, siteUrl);
  return NextResponse.redirect(target, 301);
}
