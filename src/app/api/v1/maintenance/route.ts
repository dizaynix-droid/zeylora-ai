import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    enabled: process.env.MAINTENANCE_MODE === "true"
  });
}
