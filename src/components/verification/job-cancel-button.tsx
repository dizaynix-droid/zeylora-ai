"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JobCancelButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function cancelJob() {
    if (pending) return;
    const confirmed = window.confirm("Cancel this verification job? Unprocessed credits will be refunded automatically.");
    if (!confirmed) return;

    setPending(true);
    try {
      await fetch(`/api/v1/verification/jobs/${jobId}/cancel`, {
        method: "POST",
        cache: "no-store"
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={cancelJob}
      disabled={pending}
      className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Canceling..." : "Cancel job"}
    </button>
  );
}
