import { NextResponse } from "next/server";
import { creditPackages } from "@/config/pricing";

export function GET() {
  return NextResponse.json({
    packages: creditPackages
  });
}
