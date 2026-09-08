export default function HomeLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header skeleton */}
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-3 w-28 rounded bg-neutral-800" />
          <div className="h-8 w-40 rounded bg-neutral-800" />
        </div>
        <div className="h-8 w-24 rounded-xl bg-neutral-900" />
      </header>

      {/* Quick Navigation Pills skeleton */}
      <nav className="flex items-center gap-2 overflow-x-auto pb-1">
        <div className="h-8 w-20 shrink-0 rounded-xl bg-neutral-900" />
        <div className="h-8 w-20 shrink-0 rounded-xl bg-neutral-900" />
        <div className="h-8 w-24 shrink-0 rounded-xl bg-neutral-900" />
        <div className="h-8 w-20 shrink-0 rounded-xl bg-neutral-900" />
      </nav>

      {/* Top 3 Tasks Card skeleton */}
      <section className="rounded-2xl bg-neutral-900 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 rounded bg-neutral-800" />
          <div className="h-3 w-16 rounded bg-neutral-800" />
        </div>
        <div className="space-y-2">
          <div className="h-10 rounded-xl bg-neutral-800/60" />
          <div className="h-10 rounded-xl bg-neutral-800/60" />
        </div>
      </section>

      {/* Discipline Verdict Card skeleton */}
      <section className="rounded-2xl bg-neutral-900 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-neutral-800" />
          <div className="h-5 w-16 rounded-md bg-neutral-800" />
        </div>
        <div className="h-4 w-3/4 rounded bg-neutral-800/60" />
      </section>

      {/* Goals Card skeleton */}
      <section className="rounded-2xl bg-neutral-900 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 rounded bg-neutral-800" />
          <div className="h-3 w-14 rounded bg-neutral-800" />
        </div>
        <div className="h-4 w-2/3 rounded bg-neutral-800/60" />
      </section>

      {/* Streaks Card skeleton */}
      <section className="rounded-2xl bg-neutral-900 p-4 space-y-2">
        <div className="h-4 w-20 rounded bg-neutral-800" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-10 rounded-xl bg-neutral-800/60" />
          <div className="h-10 rounded-xl bg-neutral-800/60" />
        </div>
      </section>
    </div>
  );
}
