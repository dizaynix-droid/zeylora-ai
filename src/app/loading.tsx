export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-premium-radial">
      <div className="glass-panel rounded-3xl p-8 text-center">
        <div className="mx-auto size-10 animate-pulse rounded-full bg-cyan shadow-glow" />
        <p className="mt-4 text-sm font-bold text-slate-200">Preparing the studio...</p>
      </div>
    </main>
  );
}
