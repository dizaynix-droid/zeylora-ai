"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function CreditAdjustSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Loader2 className="mr-2 animate-spin" size={14} /> : null}
      {pending ? "Kaydediliyor" : "Uygula"}
    </button>
  );
}
