import { AlertTriangle, BarChart3, Brain, CreditCard, Database, Flag, Gauge, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { adminTr } from "@/i18n/admin/tr";

const adminModules: Array<[string, string, LucideIcon]> = [
  [adminTr.overview.modules.users.title, adminTr.overview.modules.users.description, Users],
  [adminTr.overview.modules.tools.title, adminTr.overview.modules.tools.description, Brain],
  [adminTr.overview.modules.payments.title, adminTr.overview.modules.payments.description, CreditCard],
  [adminTr.overview.modules.featureFlags.title, adminTr.overview.modules.featureFlags.description, Flag],
  [adminTr.overview.modules.providerBudgets.title, adminTr.overview.modules.providerBudgets.description, Gauge],
  [adminTr.overview.modules.usageAnalytics.title, adminTr.overview.modules.usageAnalytics.description, BarChart3],
  [adminTr.overview.modules.cms.title, adminTr.overview.modules.cms.description, Database],
  [adminTr.overview.modules.errorLogs.title, adminTr.overview.modules.errorLogs.description, AlertTriangle]
];

export default function AdminPage() {
  return (
    <AppShell
      area="admin"
      title={adminTr.overview.title}
      description={adminTr.overview.description}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {adminModules.map(([title, description, Icon]) => (
          <Card key={title} className="p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-cyan">
              <Icon size={19} />
            </span>
            <h2 className="mt-4 font-black text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-5 p-6">
        <h2 className="text-xl font-black text-white">{adminTr.overview.priorityTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{adminTr.overview.priorityDescription}</p>
      </Card>
    </AppShell>
  );
}
