import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "zeylora-email-verification",
    version: "0.1.0",
    deployment: {
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      commitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null
    }
  });
}
