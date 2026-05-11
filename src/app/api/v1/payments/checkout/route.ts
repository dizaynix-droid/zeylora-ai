import { PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { creditPackages } from "@/config/pricing";
import { trackingEvents } from "@/config/tracking";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import { trackServerEvent } from "@/lib/analytics/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/payments/stripe";

export const runtime = "nodejs";

type CheckoutRequest = {
  packageKey?: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ ok: false, error: "You must be logged in to start checkout." }, { status: 401 });
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
        error: "Checkout is prepared but Stripe is not configured yet.",
        code: "stripe_not_configured"
      },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as CheckoutRequest | null;
  const selectedPackage = creditPackages.find((pack) => pack.key === body?.packageKey && pack.billingModel === "one_time_credits");

  if (!selectedPackage) {
    return NextResponse.json({ ok: false, error: "Credit package not found." }, { status: 404 });
  }

  const totalCredits = selectedPackage.credits + selectedPackage.bonusCredits;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      amount: selectedPackage.price,
      currency: selectedPackage.currency.toLowerCase(),
      creditsDelivered: 0,
      status: PaymentStatus.PENDING,
      rawEventJson: {
        provider: "stripe",
        packageKey: selectedPackage.key,
        packageName: selectedPackage.name,
        credits: totalCredits
      }
    },
    select: {
      id: true
    }
  });

  const configuredPriceId = selectedPackage.paymentProviderPriceIds.stripe;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    client_reference_id: payment.id,
    success_url: `${siteUrl}/dashboard#credits`,
    cancel_url: `${siteUrl}/pricing`,
    metadata: {
      paymentId: payment.id,
      userId: user.id,
      packageKey: selectedPackage.key,
      credits: String(totalCredits)
    },
    line_items: [
      configuredPriceId
        ? {
            price: configuredPriceId,
            quantity: 1
          }
        : {
            quantity: 1,
            price_data: {
              currency: selectedPackage.currency.toLowerCase(),
              unit_amount: Math.round(selectedPackage.price * 100),
              product_data: {
                name: `${selectedPackage.name} Credits`,
                description: `${totalCredits} Zeylora AI credits for watermark-free exports.`
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
        packageKey: selectedPackage.key,
        packageName: selectedPackage.name,
        credits: totalCredits
      }
    }
  });

  trackServerEvent(trackingEvents.checkoutStarted, {
    provider: "stripe",
    packageKey: selectedPackage.key,
    credits: totalCredits
  });

  return NextResponse.json({
    ok: true,
    provider: "stripe",
    checkoutUrl: session.url,
    sessionId: session.id,
    paymentId: payment.id
  });
}
