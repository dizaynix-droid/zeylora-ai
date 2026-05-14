export const emailProviderPlaceholders = [
  {
    key: "resend",
    name: "Resend",
    envKeys: ["RESEND_API_KEY", "EMAIL_FROM"],
    configured: Boolean(process.env.RESEND_API_KEY)
  },
  {
    key: "postmark",
    name: "Postmark",
    envKeys: ["POSTMARK_SERVER_TOKEN", "EMAIL_FROM"],
    configured: Boolean(process.env.POSTMARK_SERVER_TOKEN)
  },
  {
    key: "smtp",
    name: "SMTP fallback",
    envKeys: ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM"],
    configured: Boolean(process.env.SMTP_HOST)
  }
] as const;

export const emailTemplateDefinitions = [
  {
    key: "welcome",
    name: "Welcome email",
    eventType: "WELCOME",
    description: "Yeni kullanıcı hesabı açıldığında gönderilecek onboarding emaili."
  },
  {
    key: "ticket_reply",
    name: "Ticket reply notification",
    eventType: "TICKET_REPLY",
    description: "Admin ticket yanıtı yazdığında kullanıcıya haber verir."
  },
  {
    key: "payment_success",
    name: "Payment success",
    eventType: "PAYMENT_SUCCESS",
    description: "Stripe ödeme onaylandıktan ve kredi eklendikten sonra gönderilir."
  },
  {
    key: "credits_added",
    name: "Credits added",
    eventType: "CREDITS_ADDED",
    description: "Admin manuel kredi eklediğinde veya paket kredisi teslim edildiğinde."
  },
  {
    key: "failed_payment",
    name: "Failed payment",
    eventType: "FAILED_PAYMENT",
    description: "Ödeme başarısız/iptal olduğunda operasyonel bildirim."
  }
] as const;
