"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Loader2, Sparkles } from "lucide-react";
import { trackEvent } from "@/lib/analytics/events";
import { trackingEvents } from "@/config/tracking";

type CleanExportButtonProps = {
  jobId: string;
  creditsRequired: number;
  filename?: string;
  className?: string;
};

type CleanExportResponse = {
  ok: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  code?: string;
  requiredCredits?: number;
  creditBalance?: number;
};

export function CleanExportButton({
  jobId,
  creditsRequired,
  filename = "zeylora-clean-export.png",
  className
}: CleanExportButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [needsCredits, setNeedsCredits] = useState(false);

  async function exportClean() {
    if (isPreparing) return;
    setIsPreparing(true);
    setMessage(null);
    setNeedsCredits(false);

    try {
      const response = await fetch(`/api/v1/jobs/${jobId}/clean-export`, {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json().catch(() => null)) as CleanExportResponse | null;

      if (response.status === 402 || payload?.code === "insufficient_credits") {
        setNeedsCredits(true);
        setMessage(payload?.error || "You need more credits to export clean.");
        return;
      }

      if (!response.ok || !payload?.ok || !payload.downloadUrl) {
        throw new Error(payload?.error || "Could not prepare clean export.");
      }

      triggerHiddenDownload(payload.downloadUrl, payload.filename || filename);
      trackEvent({
        event: trackingEvents.watermarkFreeExport,
        properties: {
          jobId,
          creditsRequired
        }
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not prepare clean export.");
    } finally {
      window.setTimeout(() => setIsPreparing(false), 450);
    }
  }

  return (
    <div className="grid gap-2">
      <button type="button" onClick={exportClean} disabled={isPreparing} aria-busy={isPreparing} className={className}>
        {isPreparing ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Sparkles className="mr-2" size={16} />}
        <span>{isPreparing ? "Preparing clean export..." : `Export clean image (${creditsRequired} credits)`}</span>
      </button>
      {message ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-xs font-semibold text-slate-300">
          <p>{message}</p>
          {needsCredits ? (
            <Link href="/pricing" className="mt-2 inline-flex items-center text-cyan hover:text-white">
              <Download className="mr-1" size={13} />
              Buy credits
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function triggerHiddenDownload(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
