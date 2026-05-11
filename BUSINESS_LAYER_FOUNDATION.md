# Business Layer Foundation

This phase prepares monetization architecture without activating checkout, subscriptions, or credit enforcement.

## Credit records

Credits are stored on `User.creditBalance`.

Credit history is stored in `CreditTransaction` with:

- `PURCHASE`
- `USE`
- `REFUND`
- `ADMIN_ADJUSTMENT`
- `FREE_TRIAL`
- `REFERRAL_REWARD`

The dashboard now reads the real balance and recent credit transactions.

## Credit helper hooks

Credit mutations live in:

```txt
src/lib/credits/ledger.ts
```

Prepared hooks:

- `getCreditBalance`
- `listCreditTransactions`
- `grantFreeTrialCredits`
- `deductCreditsForJob`
- `refundCreditsForJob`
- `addPurchasedCredits`

These helpers are ready for future checkout and job enforcement, but are not wired into AI job execution yet.

## Tool costs

Current live tool costs:

- Background Remover: 2 credits
- Photo Enhancer: 3 credits

Jobs still record `creditCost`, but the app does not block, deduct, or refund credits yet.

## Pricing architecture

Pricing config lives in:

```txt
src/config/pricing.ts
```

Prepared credit packs:

- Starter
- Creator
- Pro Seller

Each pack is modeled as a one-time credit purchase and includes placeholders for future provider price IDs:

- Stripe
- Paddle
- LemonSqueezy

Subscriptions are represented as a roadmap config only. They are not active.

## Future integration path

1. Enable checkout feature flag.
2. Create provider price IDs for credit packs.
3. Add checkout session endpoint.
4. Verify provider webhooks.
5. On successful payment, call `addPurchasedCredits`.
6. When credit enforcement is approved, call `deductCreditsForJob` before job processing.
7. On failed/refunded jobs, call `refundCreditsForJob`.
8. Add admin credit adjustment actions later.

## Current non-goals

- No real checkout.
- No subscriptions.
- No credit enforcement.
- No payment provider activation.
- No admin billing UI.
