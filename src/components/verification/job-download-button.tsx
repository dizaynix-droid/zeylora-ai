"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function JobDownloadButton({
  jobId,
  type,
  label,
  variant = "primary"
}: {
  jobId: string;
  type: "valid" | "invalid" | "risky" | "full";
  label: string;
  variant?: "primary" | "secondary";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/verification/jobs/${jobId}/download?type=${type}`, { cache: "no-store" });
      const payload = await response.json();
      if (!payload?.url) throw new Error(payload?.error || "Download is not ready yet.");
      window.location.href = payload.url;
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Download is not ready yet.");
    } finally {
      setLoading(false);
    }
  }

  const className =
    variant === "secondary"
      ? "inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
      : "inline-flex min-h-10 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60";

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={download} disabled={loading} className={className}>
        {loading ? <Loader2 className="mr-2 animate-spin" size={15} /> : <Download className="mr-2" size={15} />}
        {label}
      </button>
      {error ? <span className="text-xs font-semibold text-rose-700">{error}</span> : null}
    </span>
  );
}
