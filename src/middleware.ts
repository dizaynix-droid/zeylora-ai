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

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]
};

function shouldShowMaintenance(pathname: string, enabled: boolean) {
  if (!enabled) return false;
  if (pathname.startsWith("/admin")) return false;
  return true;
}
