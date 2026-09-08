export default function AcademicsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header skeleton */}
      <header className="flex items-center justify-between">
        <div className="h-8 w-36 rounded bg-neutral-800" />
        <div className="flex gap-2">
          <div className="h-8 w-16 rounded-xl bg-neutral-900" />
          <div className="h-8 w-20 rounded-xl bg-neutral-900" />
        </div>
      </header>

      {/* Next Class Card */}
      <section className="rounded-2xl bg-neutral-900 p-4 space-y-2">
        <div className="h-4 w-28 rounded bg-neutral-800" />
        <div className="h-6 w-3/4 rounded bg-neutral-800/80" />
        <div className="h-3 w-1/3 rounded bg-neutral-800/60" />
      </section>

      {/* Today's Classes Card */}
      <section className="rounded-2xl bg-neutral-900 p-4 space-y-2">
        <div className="h-4 w-32 rounded bg-neutral-800" />
        <div className="space-y-2">
          <div className="h-12 rounded-xl bg-neutral-800/60" />
          <div className="h-12 rounded-xl bg-neutral-800/60" />
        </div>
      </section>

      {/* Attendance Zones Card */}
      <section className="rounded-2xl bg-neutral-900 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-neutral-800" />
          <div className="h-3 w-16 rounded bg-neutral-800" />
        </div>
        <div className="space-y-2">
          <div className="h-8 rounded-lg bg-neutral-800/60" />
          <div className="h-8 rounded-lg bg-neutral-800/60" />
        </div>
      </section>

      {/* Recent Performance Card */}
      <section className="rounded-2xl bg-neutral-900 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-36 rounded bg-neutral-800" />
          <div className="h-3 w-14 rounded bg-neutral-800" />
        </div>
        <div className="space-y-2">
          <div className="h-12 rounded-xl bg-neutral-800/60" />
          <div className="h-12 rounded-xl bg-neutral-800/60" />
        </div>
      </section>
    </div>
  );
}
