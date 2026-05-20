import type { EmailEventType } from "@prisma/client";

export type EmailTemplateKey =
  | "welcome"
  | "password_reset"
  | "mfa_enabled"
  | "payment_success"
  | "credits_added"
  | "verification_job_queued"
  | "verification_job_completed"
  | "verification_job_failed"
  | "referral_reward"
  | "ticket_reply"
  | "failed_payment";

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

type TemplateInput = {
  email?: string;
  name?: string | null;
  credits?: number;
  amount?: string;
  packageName?: string;
  ticketSubject?: string;
  ticketMessage?: string;
  referralName?: string;
  jobId?: string;
  fileName?: string | null;
  uniqueEmails?: number;
  validCount?: number;
  invalidCount?: number;
  riskyCount?: number;
  refundedCredits?: number;
  errorMessage?: string;
  actionUrl?: string;
  supportEmail?: string;
};

export const templateEventType: Record<EmailTemplateKey, EmailEventType> = {
  welcome: "WELCOME",
  password_reset: "PASSWORD_RESET",
  mfa_enabled: "MFA_ENABLED",
  payment_success: "PAYMENT_SUCCESSFUL",
  credits_added: "CREDITS_ADDED",
  verification_job_queued: "LOW_CREDITS",
  verification_job_completed: "JOB_COMPLETED",
  verification_job_failed: "JOB_FAILED_REFUNDED",
  referral_reward: "REFERRAL_REWARD",
  ticket_reply: "TICKET_REPLY",
  failed_payment: "FAILED_PAYMENT"
};

export function renderEmailTemplate(templateKey: EmailTemplateKey, input: TemplateInput = {}): RenderedEmail {
  const supportEmail = input.supportEmail || process.env.SUPPORT_EMAIL || "support@zeylora.ai";
  const siteUrl = sanitizeUrl(input.actionUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://www.zeylora.ai");
  const firstName = input.name?.trim() || input.email?.split("@")[0] || "there";

  if (templateKey === "welcome") {
    return createEmail({
      subject: "Welcome to Zeylora AI",
      eyebrow: "Welcome",
      title: "Your email verification workspace is ready.",
      body: `Hi ${firstName}, welcome to Zeylora AI. You can now upload email lists, verify addresses, reduce bounce risk, and download clean CSV segments with usage-based credits.`,
      cta: "Open dashboard",
      actionUrl: `${siteUrl}/dashboard`,
      footer: `Need help? Contact ${supportEmail}.`
    });
  }

  if (templateKey === "password_reset") {
    return createEmail({
      subject: "Password reset requested",
      eyebrow: "Account security",
      title: "Your password reset email is on the way.",
      body: "We received a password reset request for your Zeylora AI account. Use the secure reset link from Supabase/Auth email to set a new password. If this was not you, ignore this message.",
      cta: "Go to sign in",
      actionUrl: `${siteUrl}/auth/sign-in`,
      footer: `Security question? Contact ${supportEmail}.`
    });
  }

  if (templateKey === "mfa_enabled") {
    return createEmail({
      subject: "Two-factor authentication enabled",
      eyebrow: "Security updated",
      title: "Two-factor authentication is now active.",
      body: "Your Zeylora AI account is now protected with an authenticator app. Keep access to your authenticator app safe.",
      cta: "Review account settings",
      actionUrl: `${siteUrl}/dashboard#settings`,
      footer: `If you did not enable MFA, contact ${supportEmail} immediately.`
    });
  }

  if (templateKey === "payment_success") {
    return createEmail({
      subject: "Payment received - credits added",
      eyebrow: "Payment successful",
      title: "Your Zeylora credits are ready.",
      body: `Your payment${input.amount ? ` of ${input.amount}` : ""} was confirmed and ${input.credits ?? "your"} email verification credits were added to your account.`,
      cta: "Open dashboard",
      actionUrl: `${siteUrl}/dashboard#credits`,
      footer: "1 credit verifies 1 email address. Download segmented CSV reports after verification completes."
    });
  }

  if (templateKey === "credits_added") {
    return createEmail({
      subject: "Credits added to your account",
      eyebrow: "Credits updated",
      title: `${input.credits ?? "New"} credits added.`,
      body: `Your Zeylora AI credit balance was updated${input.packageName ? ` from ${input.packageName}` : ""}. Use credits to verify email addresses and export clean CSV segments.`,
      cta: "View credits",
      actionUrl: `${siteUrl}/dashboard#credits`,
      footer: `Questions about credits? Contact ${supportEmail}.`
    });
  }

  if (templateKey === "verification_job_queued") {
    return createEmail({
      subject: "Your email verification job has started",
      eyebrow: "Verification started",
      title: `${input.fileName || "Your list"} is queued for verification.`,
      body: `Zeylora received ${formatCount(input.uniqueEmails)} unique emails and started processing the list in safe background chunks. You can watch progress from your dashboard.`,
      cta: "View job progress",
      actionUrl: `${siteUrl}/dashboard/jobs/${input.jobId || ""}`,
      footer: "Large lists continue processing in the background. You do not need to keep the browser open."
    });
  }

  if (templateKey === "verification_job_completed") {
    return createEmail({
      subject: "Your email verification report is ready",
      eyebrow: "Verification complete",
      title: `${input.fileName || "Your list"} is ready to download.`,
      body: `We processed ${formatCount(input.uniqueEmails)} unique emails. Results: ${formatCount(input.validCount)} valid, ${formatCount(input.invalidCount)} invalid, and ${formatCount(input.riskyCount)} risky/catch-all/disposable addresses.`,
      cta: "Download report",
      actionUrl: `${siteUrl}/dashboard/jobs/${input.jobId || ""}`,
      footer: "Your segmented CSV exports are available in the job report."
    });
  }

  if (templateKey === "verification_job_failed") {
    return createEmail({
      subject: "Verification needs attention",
      eyebrow: "Verification issue",
      title: `${input.fileName || "Your list"} could not fully complete.`,
      body: `${input.errorMessage || "A processing issue stopped this verification job."}${input.refundedCredits ? ` ${formatCount(input.refundedCredits)} unused credits were refunded automatically.` : " Your credits were not charged for unprocessed emails."}`,
      cta: "Open support",
      actionUrl: `${siteUrl}/dashboard/support?jobId=${input.jobId || ""}`,
      footer: `If you need help, contact ${supportEmail} or reply from your support dashboard.`
    });
  }

  if (templateKey === "referral_reward") {
    return createEmail({
      subject: "You earned Zeylora referral credits",
      eyebrow: "Creator Program",
      title: `${input.credits ?? "New"} referral credits earned.`,
      body: `A referred customer completed a successful credit purchase${input.amount ? ` (${input.amount})` : ""}. Your Creator Program reward was delivered as platform credits you can use for email verification.`,
      cta: "Open Creator Program",
      actionUrl: `${siteUrl}/dashboard/affiliate`,
      footer: "Referral rewards are platform credits only and are not cash-withdrawable."
    });
  }

  if (templateKey === "ticket_reply") {
    return createEmail({
      subject: `Support reply: ${input.ticketSubject || "Your Zeylora ticket"}`,
      eyebrow: "Support reply",
      title: "We replied to your support ticket.",
      body: input.ticketMessage || "A support team member replied to your ticket. Open your dashboard to continue the conversation.",
      cta: "Open support",
      actionUrl: `${siteUrl}/dashboard/support`,
      footer: `You can reply from your Zeylora dashboard or contact ${supportEmail}.`
    });
  }

  return createEmail({
    subject: "Payment could not be completed",
    eyebrow: "Payment issue",
    title: "Your payment did not complete.",
    body: "Your checkout session expired or payment could not be confirmed. No credits were added and you were not charged by Zeylora for an unsuccessful checkout.",
    cta: "View pricing",
    actionUrl: `${siteUrl}/pricing`,
    footer: `Billing help: ${supportEmail}.`
  });
}

function createEmail(input: {
  subject: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  actionUrl: string;
  footer: string;
}): RenderedEmail {
  const safe = {
    subject: escapeText(input.subject),
    eyebrow: escapeText(input.eyebrow),
    title: escapeText(input.title),
    body: escapeText(input.body),
    cta: escapeText(input.cta),
    actionUrl: sanitizeUrl(input.actionUrl),
    footer: escapeText(input.footer)
  };

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#070812;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#08111f,#12071a);padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:#111827;overflow:hidden;">
          <tr><td style="padding:28px 28px 10px;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#67e8f9;">${safe.eyebrow}</div>
            <h1 style="margin:16px 0 12px;font-size:30px;line-height:1.1;color:#ffffff;">${safe.title}</h1>
            <p style="margin:0;color:#cbd5e1;font-size:16px;line-height:1.7;">${safe.body}</p>
            <a href="${safe.actionUrl}" style="display:inline-block;margin-top:24px;padding:14px 22px;border-radius:999px;background:linear-gradient(135deg,#20d3ff,#8b5cf6,#db4ca2);color:#ffffff;text-decoration:none;font-weight:900;">${safe.cta}</a>
          </td></tr>
          <tr><td style="padding:24px 28px 28px;color:#94a3b8;font-size:13px;line-height:1.6;border-top:1px solid rgba(255,255,255,.08);">
            <strong style="color:#ffffff;">Zeylora AI</strong><br/>${safe.footer}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return {
    subject: input.subject,
    html,
    text: `${input.title}\n\n${input.body}\n\n${input.cta}: ${safe.actionUrl}\n\n${input.footer}`
  };
}

function escapeText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatCount(value: unknown) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return "0";
  return numberValue.toLocaleString("en-US");
}

function sanitizeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "https://www.zeylora.ai";
    return url.toString();
  } catch {
    return "https://www.zeylora.ai";
  }
}
