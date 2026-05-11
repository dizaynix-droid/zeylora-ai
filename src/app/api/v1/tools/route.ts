import { NextResponse } from "next/server";
import { initialTools } from "@/config/tools";

export function GET() {
  return NextResponse.json({
    tools: initialTools
  });
}
