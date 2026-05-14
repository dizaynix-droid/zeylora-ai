"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics/events";
import { trackingEvents } from "@/config/tracking";

type DownloadResultButtonProps = {
  href: string;
  filename?: string;
  label?: string;
  className?: string;
};

type DownloadResponse = {
  ok: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
};

export function DownloadResultButton({
  href,
  filename = "zeylora-background-remover.png",
  label = "Download PNG",
  className
}: DownloadResultButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false);

  async function handleDownload() {
    if (isPreparing) return;

    setIsPreparing(true);

    try {
      const response = await fetch(withJsonFormat(href), {
        headers: {
          Accept: "application/json"
        },
        credentials: "same-origin"
      });
      const payload = (await response.json().catch(() => null)) as DownloadResponse | null;

      if (!response.ok || !payload?.ok || !payload.downloadUrl) {
        throw new Error(payload?.error || "Could not prepare the download.");
      }

      triggerHiddenDownload(payload.downloadUrl, payload.filename || filename);
      trackEvent({
        event: trackingEvents.previewDownloaded,
        properties: {
          filename: payload.filename || filename
        }
      });
    } catch {
      window.location.assign(href);
    } finally {
      window.setTimeout(() => setIsPreparing(false), 450);
    }
  }

  return (
    <button type="button" onClick={handleDownload} disabled={isPreparing} aria-busy={isPreparing} className={className}>
      {isPreparing ? (
        <>
          <Loader2 className="mr-2 animate-spin" size={16} />
          <span className="truncate">Preparing download...</span>
        </>
      ) : (
        <>
          <Download className="mr-2" size={16} />
          <span className="truncate">{label}</span>
        </>
      )}
    </button>
  );
}

function withJsonFormat(href: string) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}format=json`;
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
