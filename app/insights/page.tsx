import Link from "next/link";
import { loadInsights } from "@/lib/insights/actions";
import type { Pattern } from "@/lib/insights/engine";

function strengthColor(strength: Pattern["strength"]) {
  if (strength === "strong") return "text-emerald-400";
  if (strength === "moderate") return "text-yellow-300";
  if (strength === "weak") return "text-neutral-500";
  return "text-neutral-600";
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = periodParam === "month" ? "month" : "week";

  const data = await loadInsights(period);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Insights</h1>

      <div className="flex gap-2 text-xs">
        <Link
          href="/insights?period=week"
          className={`rounded-lg px-3 py-1.5 ${
            period === "week" ? "bg-white text-neutral-950" : "bg-neutral-800 text-neutral-400"
          }`}
        >
          This week
        </Link>
        <Link
          href="/insights?period=month"
          className={`rounded-lg px-3 py-1.5 ${
            period === "month" ? "bg-white text-neutral-950" : "bg-neutral-800 text-neutral-400"
          }`}
        >
          This month
        </Link>
      </div>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">AI insights</h2>
        {data.aiBullets ? (
          <ul className="space-y-1.5 text-sm">
            {data.aiBullets.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">
            {data.aiUnavailableReason ?? "AI insights unavailable."} Statistics below are still
            fully accurate — they don&apos;t depend on AI.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-400">
          Patterns ({data.daysAnalyzed} days analyzed)
        </h2>
        {data.patterns.map((p) => (
          <div key={`${p.labelA}-${p.labelB}`} className="rounded-2xl bg-neutral-900 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium capitalize">
                {p.labelA} vs {p.labelB}
              </span>
              <span className="text-xs text-neutral-500">n={p.sampleSize}</span>
            </div>
            {!p.insufficientData && (
              <p className={`text-xs ${strengthColor(p.strength)}`}>
                {p.strength} {p.direction !== "none" ? p.direction : ""} correlation (r=
                {p.r?.toFixed(2)})
              </p>
            )}
            <p className="mt-1 text-sm text-neutral-400">{p.interpretation}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-neutral-900 p-3">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Morning vs evening focus</span>
          <span className="text-xs text-neutral-500">
            n={data.morningEveningComparison.sampleSizeA}/
            {data.morningEveningComparison.sampleSizeB}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          {data.morningEveningComparison.interpretation}
        </p>
      </section>

      <p className="text-xs text-neutral-600">
        All patterns show correlation, not causation. Statistics are calculated
        deterministically by the app — AI is only used to phrase already-computed numbers.
      </p>
    </div>
  );
}
