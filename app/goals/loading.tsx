export default function GoalsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <header className="flex items-center justify-between">
        <div className="h-8 w-28 rounded bg-neutral-800" />
      </header>

      {/* GoalQuickAdd skeleton */}
      <div className="rounded-2xl bg-neutral-900 p-4 space-y-3">
        <div className="h-4 w-32 rounded bg-neutral-800" />
        <div className="h-10 rounded-lg bg-neutral-800" />
        <div className="flex gap-2">
          <div className="h-9 flex-1 rounded-lg bg-neutral-800" />
          <div className="h-9 w-20 rounded-lg bg-neutral-800" />
        </div>
      </div>

      {/* Goal Cards sections skeleton */}
      <section className="space-y-2">
        <div className="h-4 w-28 rounded bg-neutral-800" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-neutral-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-1/3 rounded bg-neutral-800" />
                <div className="h-5 w-16 rounded-md bg-neutral-800" />
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-800/80" />
              <div className="flex justify-between">
                <div className="h-3 w-20 rounded bg-neutral-800/60" />
                <div className="h-3 w-16 rounded bg-neutral-800/60" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
