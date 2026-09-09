export default function ReviewLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <header className="space-y-1">
        <div className="h-7 w-32 rounded bg-neutral-800" />
        <div className="h-3 w-56 rounded bg-neutral-800/60" />
      </header>

      {/* Section 1: Weekly Metrics skeleton */}
      <section className="space-y-3 rounded-2xl bg-neutral-900 border border-neutral-800/80 p-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-36 rounded bg-neutral-800" />
          <div className="h-3 w-16 rounded bg-neutral-800/60" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-neutral-800/50 p-3 space-y-1.5">
              <div className="h-2.5 w-16 rounded bg-neutral-700/60" />
              <div className="h-5 w-12 rounded bg-neutral-700" />
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Academic Summary skeleton */}
      <section className="space-y-3 rounded-2xl bg-neutral-900 border border-neutral-800/80 p-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-36 rounded bg-neutral-800" />
          <div className="h-3 w-20 rounded bg-neutral-800/60" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 rounded-xl bg-neutral-800/50 p-3 space-y-2">
            <div className="h-3 w-24 rounded bg-neutral-700/60" />
            <div className="h-6 w-14 rounded bg-neutral-700" />
          </div>
          <div className="h-20 rounded-xl bg-neutral-800/50 p-3 space-y-2">
            <div className="h-3 w-24 rounded bg-neutral-700/60" />
            <div className="h-6 w-14 rounded bg-neutral-700" />
          </div>
        </div>
      </section>

      {/* Section 3: Night Check-in skeleton */}
      <section className="space-y-4 rounded-2xl bg-neutral-900 border border-neutral-800/80 p-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-40 rounded bg-neutral-800" />
          <div className="h-3 w-20 rounded bg-neutral-800/60" />
        </div>
        <div className="h-12 rounded-xl bg-neutral-800/40" />
        <div className="h-24 rounded-xl bg-neutral-800/40" />
        <div className="h-12 rounded-xl bg-neutral-800/60" />
      </section>
    </div>
  );
}
