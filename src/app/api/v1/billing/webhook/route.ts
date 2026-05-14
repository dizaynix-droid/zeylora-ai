import { PaymentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { trackingEvents } from "@/config/tracking";
import { trackServerEvent } from "@/lib/analytics/server";
import { deleteDashboardCache } from "@/lib/dashboard/cache";
import { prisma } from "@/lib/db";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/payments/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ ok: false, error: "Stripe webhook is not configured." }, { status: 503 });
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
        externalEventId: null,
        eventType: "signature_verification_failed",
        payloadJson: { received: true },
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Invalid Stripe signature."
      }
    });

    return NextResponse.json({ ok: false, error: "Invalid Stripe signature." }, { status: 400 });
  }

  const webhookLog = await prisma.webhookLog
    .create({
      data: {
        source: "stripe",
        externalEventId: event.id,
        eventType: event.type,
        payloadJson: event as unknown as Prisma.InputJsonObject,
        status: "received"
      },
      select: { id: true }
    })
    .catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    });

  if (!webhookLog) {
    return NextResponse.json({ ok: true, received: true, duplicate: true });
  }

  try {
    let linkedPaymentId: string | undefined;
    let linkedUserId: string | undefined;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;
      const userId = session.metadata?.userId;
      const credits = Number(session.metadata?.credits || 0);
      linkedPaymentId = paymentId;
      linkedUserId = userId;

      if (paymentId && userId && credits > 0) {
        const processed = await prisma.$transaction(async (tx) => {
          const payment = await tx.payment.findUnique({
            where: { id: paymentId },
            select: {
              id: true,
              status: true,
              userId: true,
              stripeCheckoutSessionId: true
            }
          });

          if (!payment || payment.status === PaymentStatus.PAID) {
            return { credited: false as const, reason: payment ? "already_paid" : "missing_payment" };
          }

          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { creditBalance: true }
          });

          if (!user || payment.userId !== userId) {
            throw new Error("Stripe payment user mismatch.");
          }

          const balanceAfter = user.creditBalance + credits;
          const [paidPayment] = await Promise.all([
            tx.payment.update({
              where: { id: payment.id },
              data: {
                status: PaymentStatus.PAID,
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
                creditsDelivered: credits,
                rawEventJson: event as unknown as Prisma.InputJsonObject
              },
              select: { id: true }
            }),
            tx.user.update({
              where: { id: userId },
              data: { creditBalance: balanceAfter },
              select: { id: true }
            })
          ]);

          await tx.creditTransaction.create({
            data: {
              userId,
              paymentId: paidPayment.id,
              type: "PURCHASE",
              amount: credits,
              balanceAfter,
              note: "Stripe credit pack purchase"
            }
          });

          await tx.adminLog.create({
            data: {
              action: "payment.stripe_paid",
              entityType: "Payment",
              entityId: payment.id,
              metadataJson: {
                provider: "stripe",
                sessionId: session.id,
                credits
              }
            }
          });

          return { credited: true as const, paymentId: paidPayment.id, balanceAfter };
        });

        if (processed.credited) {
          deleteDashboardCache(`dashboard:credits:${userId}`);
          deleteDashboardCache(`dashboard:transactions:${userId}`);
          trackServerEvent(trackingEvents.checkoutCompleted, { provider: "stripe", paymentId, credits });
          trackServerEvent(trackingEvents.purchase, { provider: "stripe", paymentId, credits });
        }
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;

      if (paymentId) {
        await prisma.payment.updateMany({
          where: { id: paymentId, status: PaymentStatus.PENDING },
          data: {
            status: PaymentStatus.CANCELLED,
            rawEventJson: event as unknown as Prisma.InputJsonObject
          }
        });
      }
    }

    await prisma.webhookLog.update({
      where: { id: webhookLog.id },
      data: {
        status: "processed",
        paymentId: linkedPaymentId || null,
        userId: linkedUserId || null,
        processedAt: new Date()
      }
    });

    return NextResponse.json({ ok: true, received: true });
  } catch (error) {
    await prisma.webhookLog.update({
      where: { id: webhookLog.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Stripe webhook processing failed.",
        processedAt: new Date()
      }
    });

    return NextResponse.json({ ok: false, error: "Webhook processing failed." }, { status: 500 });
  }
}
