export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fb]">
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,.04)]">
        <div className="mx-auto size-10 animate-pulse rounded-md bg-blue-600" />
        <p className="mt-4 text-sm font-semibold text-slate-600">Preparing your workspace...</p>
      </div>
    </main>
  );
}
