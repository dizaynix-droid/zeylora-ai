import { PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { trackingEvents } from "@/config/tracking";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import { trackServerEvent } from "@/lib/analytics/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/payments/stripe";

export const runtime = "nodejs";

type CheckoutRequest = {
  packageId?: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ ok: false, error: "You must be logged in to buy credits.", code: "unauthenticated" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request, {
    action: "job",
    userId: user.id
  });

  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const stripe = getStripeClient();

  if (!stripe) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe checkout is not configured yet.",
        code: "stripe_not_configured"
      },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as CheckoutRequest | null;
  const packageId = String(body?.packageId || "");

  if (!packageId) {
    return NextResponse.json({ ok: false, error: "Credit package is required." }, { status: 400 });
  }

  const selectedPackage = await prisma.creditPackage.findFirst({
    where: {
      id: packageId,
      status: "ACTIVE",
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      credits: true,
      price: true,
      currency: true,
      stripePriceId: true
    }
  });

  if (!selectedPackage) {
    return NextResponse.json({ ok: false, error: "Active credit package not found." }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const successUrl = process.env.STRIPE_SUCCESS_URL || `${siteUrl}/dashboard#credits`;
  const cancelUrl = process.env.STRIPE_CANCEL_URL || `${siteUrl}/pricing`;
  const amount = Number(selectedPackage.price);
  const currency = selectedPackage.currency.toLowerCase();
  const credits = selectedPackage.credits;

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      amount,
      currency,
      creditsDelivered: 0,
      status: PaymentStatus.PENDING,
      rawEventJson: {
        provider: "stripe",
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        credits
      }
    },
    select: {
      id: true
    }
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    client_reference_id: payment.id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      paymentId: payment.id,
      userId: user.id,
      packageId: selectedPackage.id,
      credits: String(credits)
    },
    line_items: [
      selectedPackage.stripePriceId
        ? {
            price: selectedPackage.stripePriceId,
            quantity: 1
          }
        : {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: Math.round(amount * 100),
              product_data: {
                name: `${selectedPackage.name} Credits`,
                description: `${credits} Zeylora AI credits for watermark-free clean exports.`
              }
            }
          }
    ]
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      stripeCheckoutSessionId: session.id,
      rawEventJson: {
        provider: "stripe",
        checkoutSessionId: session.id,
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        credits
      }
    }
  });

  trackServerEvent(trackingEvents.checkoutStarted, {
    provider: "stripe",
    packageId: selectedPackage.id,
    credits
  });

  return NextResponse.json({
    ok: true,
    provider: "stripe",
    checkoutUrl: session.url,
    sessionId: session.id,
    paymentId: payment.id
  });
}
