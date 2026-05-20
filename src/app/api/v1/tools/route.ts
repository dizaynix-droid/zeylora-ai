import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    tools: [
      {
        slug: "email-verification",
        name: "Email Verification",
        category: "List cleaning",
        description: "Verify pasted or CSV/TXT email lists, remove duplicates, and export clean result segments.",
        href: "/dashboard#verify",
        status: "ACTIVE"
      }
    ]
  });
}
