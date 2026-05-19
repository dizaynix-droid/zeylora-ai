import { appConfig } from "@/config/app";
import { VerifyBadge, VerifyPageShell, VerifyPanel } from "@/components/verify-ui/core";

export default function MaintenancePage() {
  return (
    <VerifyPageShell className="grid min-h-screen place-items-center px-4 text-center">
      <VerifyPanel className="max-w-lg p-8">
        <VerifyBadge tone="amber">Maintenance mode</VerifyBadge>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-slate-950">{appConfig.name} is getting an upgrade.</h1>
        <p className="mt-4 leading-7 text-slate-600">
          We are improving the verification platform. Please check back soon.
        </p>
      </VerifyPanel>
    </VerifyPageShell>
  );
}
