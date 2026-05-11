import { appConfig } from "@/config/app";

export default function MaintenancePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-premium-radial px-4 text-center">
      <div className="glass-panel max-w-lg rounded-3xl p-8">
        <p className="eyebrow">Maintenance mode</p>
        <h1 className="mt-5 text-4xl font-black text-white">{appConfig.name} is getting an upgrade.</h1>
        <p className="mt-4 leading-7 text-slate-300">
          We are improving the studio foundation. Please check back soon.
        </p>
      </div>
    </main>
  );
}
