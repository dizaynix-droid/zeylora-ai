import { NextResponse } from "next/server";
import { z } from "zod";

const newsletterSchema = z.object({
  email: z.string().email(),
  language: z.string().min(2).max(8).default("en"),
  country: z.string().min(2).max(64).optional(),
  source: z.string().max(120).optional()
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = newsletterSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please enter a valid email address."
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    subscriber: {
      ...parsed.data,
      status: "pending_database_connection"
    }
  });
}
