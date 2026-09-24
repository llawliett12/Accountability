"use client";

import { useState, useTransition } from "react";
import { saveScoringConfig } from "@/lib/actions";
import type { ScoringWeights } from "@/lib/scoring/engine";

interface Config {
  weights: ScoringWeights;
  verdictBands: Record<string, number>;
  expectedCheckIns: number;
  onTimeToleranceMin: number;
}

const WEIGHT_LABELS: { key: keyof ScoringWeights; label: string }[] = [
  { key: "taskCompletionRate", label: "Task completion" },
  { key: "onTimeStartRate", label: "On-time start" },
  { key: "focusTimeRatio", label: "Focus time ratio" },
  { key: "trackingConsistency", label: "Tracking consistency" },
  { key: "driftPenalty", label: "Drift penalty" },
  { key: "missedCommitmentPenalty", label: "Missed commitment penalty" },
  { key: "reschedulePenalty", label: "Reschedule penalty" },
];

const VERDICT_ORDER = ["EXCELLENT", "GOOD", "AVERAGE", "WEAK", "POOR", "LOSER"];

export default function ScoringConfigEditor({
  initialConfig,
}: {
  initialConfig: Config;
}) {
  const [weights, setWeights] = useState(initialConfig.weights);
  const [bands, setBands] = useState(initialConfig.verdictBands);
  const [expectedCheckIns, setExpectedCheckIns] = useState(
    initialConfig.expectedCheckIns
  );
  const [onTimeTolerance, setOnTimeTolerance] = useState(
    initialConfig.onTimeToleranceMin
  );
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await saveScoringConfig({
        weights,
        verdictBands: bands,
        expectedCheckIns,
        onTimeToleranceMin: onTimeTolerance,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-400">
          Weights (relative contribution to the 0–100 score)
        </h2>
        <div className="space-y-2">
          {WEIGHT_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between text-sm">
              <span>{label}</span>
              <input
                type="number"
                value={weights[key]}
                onChange={(e) =>
                  setWeights({ ...weights, [key]: Number(e.target.value) })
                }
                className="w-16 rounded-lg bg-neutral-800 px-2 py-1 text-right"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-400">
          Verdict bands (minimum score for each label)
        </h2>
        <div className="space-y-2">
          {VERDICT_ORDER.map((label) => (
            <label key={label} className="flex items-center justify-between text-sm">
              <span>{label}</span>
              <input
                type="number"
                value={bands[label] ?? 0}
                onChange={(e) =>
                  setBands({ ...bands, [label]: Number(e.target.value) })
                }
                className="w-16 rounded-lg bg-neutral-800 px-2 py-1 text-right"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-400">Other</h2>
        <label className="flex items-center justify-between text-sm">
          <span>Expected check-ins / day</span>
          <input
            type="number"
            value={expectedCheckIns}
            onChange={(e) => setExpectedCheckIns(Number(e.target.value))}
            className="w-16 rounded-lg bg-neutral-800 px-2 py-1 text-right"
          />
        </label>
        <label className="mt-2 flex items-center justify-between text-sm">
          <span>On-time tolerance (min)</span>
          <input
            type="number"
            value={onTimeTolerance}
            onChange={(e) => setOnTimeTolerance(Number(e.target.value))}
            className="w-16 rounded-lg bg-neutral-800 px-2 py-1 text-right"
          />
        </label>
      </section>

      <button
        onClick={save}
        disabled={pending}
        className="w-full rounded-lg bg-white py-3 font-medium text-neutral-950"
      >
        {pending ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
      </button>
    </div>
  );
}
