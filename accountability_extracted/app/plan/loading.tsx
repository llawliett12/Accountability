export default function PlanLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Day Switcher skeleton */}
      <div className="flex items-center justify-between rounded-2xl bg-neutral-900 border border-neutral-800/80 p-2.5">
        <div className="h-11 w-11 rounded-xl bg-neutral-800/80" />
        <div className="space-y-1 text-center">
          <div className="h-4 w-32 mx-auto rounded bg-neutral-800" />
          <div className="h-3 w-20 mx-auto rounded bg-neutral-800/60" />
        </div>
        <div className="h-11 w-11 rounded-xl bg-neutral-800/80" />
      </div>

      {/* Top 3 Priorities skeleton */}
      <section className="space-y-3 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-neutral-800" />
          <div className="h-3 w-16 rounded bg-neutral-800" />
        </div>
        <div className="space-y-2">
          <div className="h-14 rounded-xl bg-neutral-800/70" />
          <div className="h-14 rounded-xl bg-neutral-800/70" />
          <div className="h-14 rounded-xl bg-neutral-800/70" />
        </div>
      </section>

      {/* Schedule skeleton */}
      <section className="space-y-3 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-36 rounded bg-neutral-800" />
          <div className="h-7 w-20 rounded-lg bg-neutral-800" />
        </div>
        <div className="space-y-2">
          <div className="h-12 rounded-xl bg-neutral-800/60" />
          <div className="h-12 rounded-xl bg-neutral-800/60" />
        </div>
      </section>

      {/* Tasks skeleton */}
      <section className="space-y-3">
        <div className="h-4 w-28 rounded bg-neutral-800" />
        <div className="h-14 rounded-xl bg-neutral-900 border border-neutral-800/80" />
        <div className="space-y-2">
          <div className="h-12 rounded-xl bg-neutral-900/80" />
          <div className="h-12 rounded-xl bg-neutral-900/80" />
          <div className="h-12 rounded-xl bg-neutral-900/80" />
        </div>
      </section>
    </div>
  );
}
