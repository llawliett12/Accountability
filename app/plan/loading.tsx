export default function PlanLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-36 rounded bg-neutral-800" />

      {/* TaskQuickAdd skeleton */}
      <div className="rounded-2xl bg-neutral-900 p-3 space-y-2">
        <div className="flex gap-2">
          <div className="h-10 flex-1 rounded-lg bg-neutral-800" />
          <div className="h-10 w-10 rounded-lg bg-neutral-800" />
          <div className="h-10 w-16 rounded-lg bg-neutral-800" />
        </div>
      </div>

      {/* Task list skeleton */}
      <ul className="space-y-2">
        {[1, 2, 3].map((i) => (
          <li key={i} className="rounded-2xl bg-neutral-900 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="h-4 w-1/2 rounded bg-neutral-800" />
              <div className="h-4 w-16 rounded-lg bg-neutral-800" />
            </div>
            <div className="flex gap-2">
              <div className="h-11 flex-1 rounded-xl bg-neutral-800/80" />
              <div className="h-11 flex-1 rounded-xl bg-neutral-800/80" />
              <div className="h-11 flex-1 rounded-xl bg-neutral-800/80" />
              <div className="h-11 flex-1 rounded-xl bg-neutral-800/80" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
