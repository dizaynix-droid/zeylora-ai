export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-[#f7f8fb]">
      <div className="mx-auto grid w-full max-w-[1760px] gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="h-[560px] rounded-lg border border-slate-200 bg-white p-3">
          <div className="h-9 rounded-md bg-slate-100" />
          <div className="mt-5 grid gap-2">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="h-9 rounded-md bg-slate-100" />
            ))}
          </div>
        </aside>
        <section className="min-w-0">
          <div className="h-5 w-44 rounded-md bg-blue-100" />
          <div className="mt-4 h-10 w-80 rounded-md bg-slate-100" />
          <div className="mt-3 h-5 w-[560px] max-w-full rounded-md bg-slate-100" />
          <div className="mt-5 grid gap-3 md:grid-cols-3 2xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-28 rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
          <div className="mt-4 h-[520px] rounded-lg border border-slate-200 bg-white" />
        </section>
      </div>
    </main>
  );
}
