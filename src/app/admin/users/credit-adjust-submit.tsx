"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function CreditAdjustSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className="inline-flex h-9 items-center justify-center rounded-full bg-zeylora-brand px-4 text-xs font-black text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Loader2 className="mr-2 animate-spin" size={14} /> : null}
      {pending ? "Kaydediliyor" : "Uygula"}
    </button>
  );
}
