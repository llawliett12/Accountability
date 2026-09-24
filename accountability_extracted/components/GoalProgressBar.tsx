export default function GoalProgressBar({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
      <div
        className="h-full rounded-full bg-emerald-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
