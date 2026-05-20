import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "zeylora-email-verification",
    version: "0.1.0"
  });
}
