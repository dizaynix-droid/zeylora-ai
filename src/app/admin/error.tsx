"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin-page-failed]", {
      message: error.message,
      digest: error.digest
    });
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Admin fallback</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Admin sayfası güvenli moda geçti.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Bir admin widget veya veri sorgusu yüklenemedi. Auth korunuyor; sayfayı tekrar deneyebilir veya sistem/migration durumunu kontrol edebilirsin.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Tekrar dene
          </button>
          <Link
            href="/admin/system"
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Sistem durumuna git
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
