export default function HomeLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header skeleton */}
      <header className="space-y-1">
        <div className="h-4 w-28 rounded bg-neutral-800" />
        <div className="h-7 w-48 rounded bg-neutral-800" />
      </header>

      {/* Progress Bar Card skeleton */}
      <section className="rounded-2xl bg-neutral-900 border border-neutral-800/80 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="h-3 w-28 rounded bg-neutral-800" />
          <div className="h-4 w-12 rounded bg-neutral-800" />
        </div>
        <div className="h-3 w-full rounded-full bg-neutral-800" />
      </section>

      {/* Top 3 Priorities Card skeleton */}
      <section className="rounded-2xl bg-neutral-900 border border-neutral-800/80 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-neutral-800" />
          <div className="h-3 w-16 rounded bg-neutral-800" />
        </div>
        <div className="space-y-2">
          <div className="h-11 rounded-xl bg-neutral-800/70" />
          <div className="h-11 rounded-xl bg-neutral-800/70" />
          <div className="h-11 rounded-xl bg-neutral-800/70" />
        </div>
      </section>

      {/* Next Event Card skeleton */}
      <section className="rounded-2xl bg-neutral-900 border border-neutral-800/80 p-4 space-y-2">
        <div className="h-3 w-24 rounded bg-neutral-800" />
        <div className="h-5 w-3/4 rounded bg-neutral-800/80" />
      </section>

      {/* Bottom row: Streak & Insights skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-2xl bg-neutral-900 border border-neutral-800/80 p-3" />
        <div className="h-20 rounded-2xl bg-neutral-900 border border-neutral-800/80 p-3" />
      </div>
    </div>
  );
}
