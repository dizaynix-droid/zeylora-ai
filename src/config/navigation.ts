import { adminTr } from "@/i18n/admin/tr";

export const marketingNav = [
  { label: "Tools", href: "/tools" },
  { label: "Pricing", href: "/pricing" },
  { label: "Examples", href: "/#examples" },
  { label: "FAQ", href: "/faq" }
] as const;

export const dashboardNav = [
  { label: "Overview", href: "/dashboard#overview" },
  { label: "Jobs", href: "/dashboard#jobs" },
  { label: "Support", href: "/dashboard/support" },
  { label: "Tickets", href: "/dashboard/tickets" },
  { label: "Credits", href: "/dashboard#credits" },
  { label: "Payments", href: "/dashboard#payments" },
  { label: "Settings", href: "/dashboard#settings" }
] as const;

export const adminNav = [
  { label: adminTr.nav.overview, href: "/admin" },
  { label: adminTr.nav.users, href: "/admin/users" },
  { label: adminTr.nav.tools, href: "/admin/tools" },
  { label: adminTr.nav.jobs, href: "/admin/jobs" },
  { label: adminTr.nav.tickets, href: "/admin/tickets" },
  { label: adminTr.nav.credits, href: "/admin/credits" },
  { label: adminTr.nav.pricing, href: "/admin/pricing" },
  { label: adminTr.nav.payments, href: "/admin/payments" },
  { label: adminTr.nav.cms, href: "/admin/cms" },
  { label: adminTr.nav.providers, href: "/admin/providers" },
  { label: adminTr.nav.featureFlags, href: "/admin/feature-flags" },
  { label: adminTr.nav.reports, href: "/admin/reports" },
  { label: adminTr.nav.analytics, href: "/admin/analytics" },
  { label: adminTr.nav.settings, href: "/admin/settings" },
  { label: adminTr.nav.system, href: "/admin/system" },
  { label: adminTr.nav.qa, href: "/admin/qa" },
  { label: adminTr.nav.logs, href: "/admin/logs" }
] as const;
