CREATE INDEX IF NOT EXISTS "CreditTransaction_paymentId_idx" ON "CreditTransaction"("paymentId");
CREATE INDEX IF NOT EXISTS "VerificationJob_userId_createdAt_idx" ON "VerificationJob"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "VerificationJob_createdAt_status_idx" ON "VerificationJob"("createdAt", "status");
CREATE INDEX IF NOT EXISTS "VerificationEmailResult_verificationJobId_createdAt_idx" ON "VerificationEmailResult"("verificationJobId", "createdAt");
CREATE INDEX IF NOT EXISTS "VerificationEmailResult_verificationJobId_status_createdAt_idx" ON "VerificationEmailResult"("verificationJobId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_stripePaymentIntentId_idx" ON "Payment"("stripePaymentIntentId");
