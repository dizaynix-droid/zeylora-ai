import { PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { trackingEvents } from "@/config/tracking";
import { trackServerEvent } from "@/lib/analytics/server";
import { addPurchasedCredits } from "@/lib/credits/ledger";
import { prisma } from "@/lib/db";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/payments/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe webhook is not configured."
      },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ ok: false, error: "Missing Stripe signature." }, { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    await prisma.webhookLog.create({
      data: {
        source: "stripe",
        eventType: "signature_verification_failed",
        payloadJson: { received: true },
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Invalid Stripe signature."
      }
    });

    return NextResponse.json({ ok: false, error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;
      const userId = session.metadata?.userId;
      const credits = Number(session.metadata?.credits || 0);

      if (paymentId && userId && credits > 0) {
        const existingPayment = await prisma.payment.findUnique({
          where: { id: paymentId },
          select: {
            id: true,
            status: true,
            stripeCheckoutSessionId: true
          }
        });

        if (existingPayment && existingPayment.status !== PaymentStatus.PAID) {
          const paidPayment = await prisma.payment.update({
            where: { id: paymentId },
            data: {
              status: PaymentStatus.PAID,
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
              creditsDelivered: credits,
              rawEventJson: event as unknown as object
            },
            select: {
              id: true
            }
          });

          await addPurchasedCredits({
            userId,
            paymentId: paidPayment.id,
            amount: credits,
            note: "Stripe credit pack purchase"
          });

          trackServerEvent(trackingEvents.checkoutCompleted, {
            provider: "stripe",
            paymentId,
            credits
          });
          trackServerEvent(trackingEvents.purchase, {
            provider: "stripe",
            paymentId,
            credits
          });
        }
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;

      if (paymentId) {
        await prisma.payment.updateMany({
          where: {
            id: paymentId,
            status: PaymentStatus.PENDING
          },
          data: {
            status: PaymentStatus.CANCELLED,
            rawEventJson: event as unknown as object
          }
        });
      }
    }

    await prisma.webhookLog.create({
      data: {
        source: "stripe",
        eventType: event.type,
        payloadJson: event as unknown as object,
        status: "processed"
      }
    });

    return NextResponse.json({ ok: true, received: true });
  } catch (error) {
    await prisma.webhookLog.create({
      data: {
        source: "stripe",
        eventType: event.type,
        payloadJson: event as unknown as object,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Stripe webhook processing failed."
      }
    });

    return NextResponse.json({ ok: false, error: "Webhook processing failed." }, { status: 500 });
  }
}
