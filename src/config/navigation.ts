export const marketingNav = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Results", href: "/#results" },
  { label: "FAQ", href: "/faq" }
] as const;

export const dashboardNav = [
  { label: "Overview", href: "/dashboard#overview" },
  { label: "Verify List", href: "/dashboard#verify" },
  { label: "History", href: "/dashboard#jobs" },
  { label: "Support Tickets", href: "/dashboard/support" },
  { label: "Partner Program", href: "/dashboard/affiliate" },
  { label: "Verification Credits", href: "/dashboard#credits" },
  { label: "Payments", href: "/dashboard#payments" },
  { label: "Settings", href: "/dashboard#settings" }
] as const;

export const adminNav = [
  { label: "Genel Bakış", href: "/admin" },
  { label: "Kullanıcılar", href: "/admin/users" },
  { label: "Doğrulama İşleri", href: "/admin/verification-jobs" },
  { label: "Email Sonuçları", href: "/admin/email-results" },
  { label: "Kredi Defteri", href: "/admin/credits" },
  { label: "Ödemeler", href: "/admin/payments" },
  { label: "Paket Yönetimi", href: "/admin/pricing" },
  { label: "Provider Yönetimi", href: "/admin/providers" },
  { label: "Raporlar", href: "/admin/reports" },
  { label: "Analizler", href: "/admin/analytics" },
  { label: "Destek", href: "/admin/tickets" },
  { label: "Ayarlar", href: "/admin/settings" },
  { label: "Sistem Sağlığı", href: "/admin/system" },
  { label: "Kayıtlar", href: "/admin/logs" }
] as const;
