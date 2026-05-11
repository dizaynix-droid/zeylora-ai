import { NextResponse } from "next/server";
import { getDefaultFeatureFlags } from "@/lib/feature-flags";

export function GET() {
  return NextResponse.json({
    flags: getDefaultFeatureFlags()
  });
}
