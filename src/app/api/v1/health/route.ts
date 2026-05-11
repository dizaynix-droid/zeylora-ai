import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "ai-photo-saas",
    version: "0.1.0"
  });
}
