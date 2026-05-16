"use client";

import { useState } from "react";

export function ReferralLinkCopy({ referralUrl }: { referralUrl: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(referralUrl).catch(() => null);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
      className="inline-flex h-11 items-center justify-center rounded-full bg-zeylora-brand px-5 text-sm font-black text-white shadow-glow transition hover:brightness-110"
    >
      {copied ? "Copied" : "Copy referral link"}
    </button>
  );
}
