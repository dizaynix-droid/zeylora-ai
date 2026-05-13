import { NextResponse } from "next/server";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";

export async function GET() {
  const packages = await getCreditPackagesForDisplay();

  return NextResponse.json({
    packages
  });
}
