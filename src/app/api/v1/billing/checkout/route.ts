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
  packageId?: string;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();

  try {
    checkoutLog("started", { requestId });
    const user = await getCurrentUser(request);

    if (!user) {
      checkoutLog("unauthenticated", { requestId, ms: Date.now() - startedAt });
      return NextResponse.json({ ok: false, error: "You must be logged in to buy credits.", code: "unauthenticated" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(request, {
      action: "job",
      userId: user.id,
      role: user.role
    });

    if (!rateLimit.ok) {
      checkoutLog("rate_limited", { requestId, userId: user.id, ms: Date.now() - startedAt });
      return rateLimitResponse(rateLimit);
    }

    const stripe = getStripeClient();

    if (!stripe) {
      checkoutLog("stripe_missing", { requestId, userId: user.id, ms: Date.now() - startedAt });
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
      checkoutLog("missing_package", { requestId, userId: user.id, ms: Date.now() - startedAt });
      return NextResponse.json({ ok: false, error: "Credit package is required." }, { status: 400 });
    }

    const dbPackage = await prisma.creditPackage.findFirst({
      where: {
        id: packageId,
        status: "ACTIVE",
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        credits: true,
        bonusCredits: true,
        price: true,
        currency: true,
        stripePriceId: true
      }
    });
    const selectedPackage = dbPackage ?? getConfigPackageFallback(packageId);

    if (!selectedPackage) {
      checkoutLog("package_not_found", { requestId, userId: user.id, packageId, ms: Date.now() - startedAt });
      return NextResponse.json({ ok: false, error: "Active credit package not found." }, { status: 404 });
    }

    const checkoutUrls = getCheckoutUrls();
    const successUrl = checkoutUrls.successUrl;
    const cancelUrl = checkoutUrls.cancelUrl;
    const amount = Number(selectedPackage.price);
    const currency = selectedPackage.currency.toLowerCase();
    const credits = selectedPackage.credits + selectedPackage.bonusCredits;
    const stripePriceId = normalizeStripePriceId(selectedPackage.stripePriceId);

    if (!Number.isFinite(amount) || amount <= 0) {
      checkoutLog("invalid_amount", { requestId, userId: user.id, packageId, amount, ms: Date.now() - startedAt });
      return NextResponse.json({ ok: false, error: "Credit package price is not valid." }, { status: 400 });
    }

    checkoutLog("package_loaded", {
      requestId,
      userId: user.id,
      packageId: selectedPackage.id,
      packageName: selectedPackage.name,
      packageSource: dbPackage ? "db" : "config_fallback",
      amount,
      currency,
      credits,
      hasStripePriceId: Boolean(stripePriceId),
      ignoredStripePriceId: Boolean(selectedPackage.stripePriceId && !stripePriceId),
      successUrl: sanitizeUrlForLog(successUrl),
      cancelUrl: sanitizeUrlForLog(cancelUrl)
    });

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
          packageSource: dbPackage ? "db" : "config_fallback",
          credits,
          checkoutRequestId: requestId
        }
      },
      select: {
        id: true
      }
    });

    const priceDataLineItem = {
      quantity: 1,
      price_data: {
        currency,
        unit_amount: Math.round(amount * 100),
        product_data: {
          name: `${selectedPackage.name} Credits`,
          description: `${credits} Zeylora AI credits for watermark-free clean exports.`
        }
      }
    };
    const sessionBase = {
      mode: "payment" as const,
      customer_email: user.email,
      client_reference_id: payment.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        paymentId: payment.id,
        userId: user.id,
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        credits: String(credits)
      }
    };
    let lineItemMode = stripePriceId ? "stripe_price_id" : "price_data";
    let session;

    try {
      session = await stripe.checkout.sessions.create({
        ...sessionBase,
        line_items: [
          stripePriceId
            ? {
                price: stripePriceId,
                quantity: 1
              }
            : priceDataLineItem
        ]
      });
    } catch (stripeError) {
      if (!stripePriceId) {
        throw stripeError;
      }

      checkoutLog("stripe_price_failed_retrying_price_data", {
        requestId,
        userId: user.id,
        packageId: selectedPackage.id,
        stripePriceId,
        errorName: stripeError instanceof Error ? stripeError.name : "UnknownError",
        errorMessage: stripeError instanceof Error ? stripeError.message : "Stripe price checkout failed."
      });

      lineItemMode = "price_data_fallback";
      session = await stripe.checkout.sessions.create({
        ...sessionBase,
        line_items: [priceDataLineItem]
      });
    }

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        stripeCheckoutSessionId: session.id,
        rawEventJson: {
          provider: "stripe",
          checkoutSessionId: session.id,
          packageId: selectedPackage.id,
          packageName: selectedPackage.name,
          packageSource: dbPackage ? "db" : "config_fallback",
          credits,
          lineItemMode,
          successUrl,
          cancelUrl,
          checkoutRequestId: requestId
        }
      }
    });

    trackServerEvent(trackingEvents.checkoutStarted, {
      userId: user.id,
      provider: "stripe",
      packageId: selectedPackage.id,
      paymentId: payment.id,
      credits
    });
    if (user.referredByUserId) {
      trackServerEvent(trackingEvents.referralCheckout, {
        userId: user.id,
        affiliateUserId: user.referredByUserId,
        provider: "stripe",
        packageId: selectedPackage.id,
        paymentId: payment.id,
        credits
      });
    }

    checkoutLog("session_created", {
      requestId,
      userId: user.id,
      packageId: selectedPackage.id,
      paymentId: payment.id,
      sessionId: session.id,
      lineItemMode,
      ms: Date.now() - startedAt
    });

    return NextResponse.json({
      ok: true,
      provider: "stripe",
      url: session.url,
      checkoutUrl: session.url,
      sessionId: session.id,
      paymentId: payment.id
    });
  } catch (error) {
    checkoutLog("failed", {
      requestId,
      ms: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Stripe checkout failed."
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Could not start checkout. Please try again or contact support.",
        code: "checkout_failed"
      },
      { status: 500 }
    );
  }
}

function getConfigPackageFallback(packageId: string) {
  const pack = creditPackages.find((item) => item.key === packageId || item.featureFlagKey === packageId);

  if (!pack) return null;

  return {
    id: pack.key,
    name: pack.name,
    credits: pack.credits,
    bonusCredits: pack.bonusCredits,
    price: pack.price,
    currency: pack.currency.toLowerCase(),
    stripePriceId: pack.paymentProviderPriceIds.stripe ?? null
  };
}

function normalizeStripePriceId(value: string | null) {
  const priceId = value?.trim();

  if (!priceId) {
    return null;
  }

  if (!priceId.startsWith("price_")) {
    return null;
  }

  return priceId;
}

function getCheckoutUrls() {
  const siteUrl = normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_SITE_URL, "https://www.zeylora.ai");

  return {
    successUrl: normalizeAbsoluteUrl(
      process.env.STRIPE_SUCCESS_URL,
      `${siteUrl.origin}/dashboard?checkout=success`
    ).toString(),
    cancelUrl: normalizeAbsoluteUrl(
      process.env.STRIPE_CANCEL_URL,
      `${siteUrl.origin}/pricing?checkout=cancelled`
    ).toString()
  };
}

function normalizeAbsoluteUrl(value: string | undefined, fallback: string) {
  const rawValue = stripWrappingQuotes(value?.trim() || "");
  const rawFallback = stripWrappingQuotes(fallback.trim());
  const candidate = rawValue || rawFallback;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Checkout URL must use http or https.");
    }

    return url;
  } catch {
    const fallbackUrl = new URL(rawFallback);
    if (fallbackUrl.protocol !== "https:" && fallbackUrl.protocol !== "http:") {
      return new URL("https://www.zeylora.ai");
    }

    return fallbackUrl;
  }
}

function stripWrappingQuotes(value: string) {
  return value.replace(/^["']|["']$/g, "");
}

function sanitizeUrlForLog(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return "invalid_url";
  }
}

function checkoutLog(event: string, payload: Record<string, unknown>) {
  const logPayload = {
    event,
    ...payload
  };

  if (event === "failed") {
    console.error("[billing-checkout]", logPayload);
    return;
  }

  console.info("[billing-checkout]", logPayload);
}
