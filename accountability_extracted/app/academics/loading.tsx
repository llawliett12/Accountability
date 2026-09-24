export default function AcademicsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header skeleton */}
      <header className="space-y-1">
        <div className="h-7 w-40 rounded bg-neutral-800" />
        <div className="h-3 w-56 rounded bg-neutral-800/60" />
      </header>

      {/* Segmented Tabs skeleton */}
      <div className="flex gap-1 rounded-2xl bg-neutral-900 border border-neutral-800/80 p-1.5 overflow-x-auto">
        <div className="h-11 flex-1 min-w-[80px] rounded-xl bg-neutral-800/80" />
        <div className="h-11 flex-1 min-w-[80px] rounded-xl bg-neutral-800/50" />
        <div className="h-11 flex-1 min-w-[80px] rounded-xl bg-neutral-800/50" />
        <div className="h-11 flex-1 min-w-[80px] rounded-xl bg-neutral-800/50" />
        <div className="h-11 flex-1 min-w-[80px] rounded-xl bg-neutral-800/50" />
      </div>

      {/* Action Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-36 rounded bg-neutral-800" />
        <div className="h-7 w-28 rounded-lg bg-neutral-800" />
      </div>

      {/* Spreadsheet Table skeleton */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 overflow-hidden">
        <div className="h-10 border-b border-neutral-800 bg-neutral-950/60" />
        <div className="divide-y divide-neutral-800/60">
          <div className="h-12 bg-neutral-900/40" />
          <div className="h-12 bg-neutral-900/40" />
          <div className="h-12 bg-neutral-900/40" />
          <div className="h-12 bg-neutral-900/40" />
        </div>
      </div>
    </div>
  );
}
