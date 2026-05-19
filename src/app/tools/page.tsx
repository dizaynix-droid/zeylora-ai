import { ArrowRight, FileSpreadsheet, ShieldCheck, UploadCloud } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { VerifyAction, VerifyBadge, VerifyContainer, VerifyPageShell, VerifyPanel } from "@/components/verify-ui/core";

export default function ToolsPage() {
  return (
    <>
      <SiteHeader />
      <VerifyPageShell>
        <VerifyContainer className="py-12 lg:py-16">
          <VerifyBadge tone="blue">Verification workflow</VerifyBadge>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-6xl">
            One focused workspace for email list cleaning.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Upload CSV/TXT lists, verify emails, remove risky records, and download segmented reports from the dashboard.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <VerifyAction href="/dashboard#verify">
              Open verification workspace
              <ArrowRight size={18} />
            </VerifyAction>
            <VerifyAction href="/" variant="secondary">Back to homepage</VerifyAction>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <WorkflowCard icon={UploadCloud} title="Upload list" copy="CSV/TXT upload or manual paste with email extraction and deduplication." />
            <WorkflowCard icon={ShieldCheck} title="Verify quality" copy="Detect valid, invalid, risky, catch-all, disposable, and unknown emails." />
            <WorkflowCard icon={FileSpreadsheet} title="Export segments" copy="Download valid-only, invalid-only, risky/catch-all, disposable, and full CSV reports." />
          </div>
        </VerifyContainer>
      </VerifyPageShell>
      <SiteFooter />
    </>
  );
}

function WorkflowCard({ icon: Icon, title, copy }: { icon: typeof UploadCloud; title: string; copy: string }) {
  return (
    <VerifyPanel className="p-5">
      <div className="w-fit rounded-md bg-blue-50 p-3 text-blue-700">
        <Icon size={22} />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
    </VerifyPanel>
  );
}
