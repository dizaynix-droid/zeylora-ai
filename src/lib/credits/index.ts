export type CreditDecision =
  | { allowed: true; balanceAfter: number }
  | { allowed: false; reason: "insufficient_credits"; required: number; balance: number };

export function canSpendCredits(balance: number, cost: number): CreditDecision {
  if (balance < cost) {
    return {
      allowed: false,
      reason: "insufficient_credits",
      required: cost,
      balance
    };
  }

  return {
    allowed: true,
    balanceAfter: balance - cost
  };
}

export function refundCredits(balance: number, amount: number) {
  return balance + Math.max(amount, 0);
}
