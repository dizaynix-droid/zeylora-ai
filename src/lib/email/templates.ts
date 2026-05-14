import type { EmailEventType } from "@prisma/client";

export type EmailTemplateKey =
  | "welcome"
  | "password_reset"
  | "mfa_enabled"
  | "payment_success"
  | "credits_added"
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
  actionUrl?: string;
  supportEmail?: string;
};

export const templateEventType: Record<EmailTemplateKey, EmailEventType> = {
  welcome: "WELCOME",
  password_reset: "PASSWORD_RESET",
  mfa_enabled: "MFA_ENABLED",
  payment_success: "PAYMENT_SUCCESSFUL",
  credits_added: "CREDITS_ADDED",
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
      title: "Your ecommerce photo studio is ready.",
      body: `Hi ${firstName}, welcome to Zeylora AI. You can now create branded previews, keep your edit history, and unlock clean product exports with credits.`,
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
      body: `Your payment${input.amount ? ` of ${input.amount}` : ""} was confirmed and ${input.credits ?? "your"} credits were added to your account.`,
      cta: "Open dashboard",
      actionUrl: `${siteUrl}/dashboard#credits`,
      footer: "Clean exports are unlocked with credits and can be re-downloaded without another charge."
    });
  }

  if (templateKey === "credits_added") {
    return createEmail({
      subject: "Credits added to your account",
      eyebrow: "Credits updated",
      title: `${input.credits ?? "New"} credits added.`,
      body: `Your Zeylora AI credit balance was updated${input.packageName ? ` from ${input.packageName}` : ""}. Use credits to unlock clean, watermark-free product exports.`,
      cta: "View credits",
      actionUrl: `${siteUrl}/dashboard#credits`,
      footer: `Questions about credits? Contact ${supportEmail}.`
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

function sanitizeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "https://www.zeylora.ai";
    return url.toString();
  } catch {
    return "https://www.zeylora.ai";
  }
}
