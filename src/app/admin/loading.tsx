export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-cinematic-depth">
      <div className="mx-auto grid w-[min(100%-24px,1760px)] gap-5 py-4 md:w-[min(100%-32px,1760px)] md:py-6 xl:grid-cols-[250px_minmax(0,1fr)] xl:gap-6">
        <aside className="glass-panel h-[560px] rounded-2xl p-3">
          <div className="h-10 rounded-xl bg-white/10" />
          <div className="mt-5 grid gap-2">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="h-9 rounded-xl bg-white/5" />
            ))}
          </div>
        </aside>
        <section className="min-w-0">
          <div className="h-6 w-44 rounded-full bg-cyan/15" />
          <div className="mt-4 h-10 w-80 rounded-2xl bg-white/10" />
          <div className="mt-3 h-5 w-[560px] max-w-full rounded-xl bg-white/5" />
          <div className="mt-5 grid gap-3 md:grid-cols-3 2xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-28 rounded-2xl border border-white/10 bg-white/5" />
            ))}
          </div>
          <div className="mt-4 h-[520px] rounded-2xl border border-white/10 bg-white/5" />
        </section>
      </div>
    </main>
  );
}
