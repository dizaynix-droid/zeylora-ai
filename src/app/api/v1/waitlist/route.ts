import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const waitlistSchema = z.object({
  email: z.string().email(),
  source: z.string().trim().max(120).default("homepage_early_access"),
  metadata: z.object({
    landingPage: z.string().trim().max(160).optional(),
    selectedTool: z.string().trim().max(80).optional()
  }).optional()
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = waitlistSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please enter a valid email address."
      },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const requestUrl = new URL(request.url);
  const metadata = {
    ...parsed.data.metadata,
    landingPage: parsed.data.metadata?.landingPage || requestUrl.origin,
    userAgent: request.headers.get("user-agent")?.slice(0, 240) || undefined
  };

  try {
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true, email: true }
    });

    if (existing) {
      await prisma.newsletterSubscriber.update({
        where: { email },
        data: {
          source: parsed.data.source,
          metadataJson: toPrismaJson({
            ...metadata,
            duplicateSignupAt: new Date().toISOString()
          }),
          status: "ACTIVE"
        }
      });

      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: "You are already on the early access list."
      });
    }

    const subscriber = await prisma.newsletterSubscriber.create({
      data: {
        email,
        source: parsed.data.source,
        metadataJson: toPrismaJson(metadata)
      },
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      ok: true,
      duplicate: false,
      message: "You are on the early access list.",
      subscriber
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: "You are already on the early access list."
      });
    }

    console.error("Waitlist signup failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "We could not join the waitlist right now. Please try again."
      },
      { status: 500 }
    );
  }
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
