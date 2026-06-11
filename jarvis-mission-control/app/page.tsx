import VitalsPanel from "@/components/VitalsPanel";

export default function Home() {
  return (
    <main className="mx-auto max-w-[1600px] p-4">
      <header className="mb-4 flex items-baseline gap-4">
        <h1 className="text-lg uppercase tracking-[0.35em] text-cyan glow-text">
          J.A.R.V.I.S
        </h1>
        <span className="text-[10px] uppercase tracking-widest text-dim">
          Mission Control
        </span>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <VitalsPanel />
      </div>
    </main>
  );
}
