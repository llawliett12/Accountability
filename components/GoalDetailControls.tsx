"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGoal, deleteGoal } from "@/lib/goals/actions";
import type { GoalStatus } from "@/lib/goals/types";

const STATUS_OPTIONS: { value: GoalStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

export default function GoalDetailControls({
  goalId,
  status,
  currentValue,
  targetValue,
  manualProgress,
  hasChildren,
  linkedTaskCount,
}: {
  goalId: string;
  status: GoalStatus;
  currentValue: number | null;
  targetValue: number | null;
  manualProgress: number | null;
  hasChildren: boolean;
  linkedTaskCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [currentValueInput, setCurrentValueInput] = useState(
    currentValue !== null ? String(currentValue) : ""
  );
  const [manualInput, setManualInput] = useState(
    manualProgress !== null ? String(manualProgress) : ""
  );
  const router = useRouter();

  function setStatus(newStatus: GoalStatus) {
    startTransition(() => updateGoal(goalId, { status: newStatus }));
  }

  function saveCurrentValue() {
    const n = currentValueInput.trim() === "" ? null : Number(currentValueInput);
    startTransition(() => updateGoal(goalId, { current_value: n }));
  }

  function saveManualProgress() {
    const n = manualInput.trim() === "" ? null : Number(manualInput);
    startTransition(() => updateGoal(goalId, { manual_progress: n }));
  }

  function onDelete() {
    if (!confirm("Delete this goal? Child goals are removed too; linked tasks stay but unlink.")) {
      return;
    }
    startTransition(async () => {
      await deleteGoal(goalId);
      router.push("/goals");
    });
  }

  // Progress source priority (children > target/current > tasks > manual)
  // decides which manual controls actually matter right now.
  const showTargetControl = !hasChildren && targetValue !== null;
  const showManualControl = !hasChildren && targetValue === null && linkedTaskCount === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={pending}
            onClick={() => setStatus(opt.value)}
            className={`rounded-lg px-2.5 py-1 text-xs ${
              status === opt.value ? "bg-white text-neutral-950" : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {showTargetControl && (
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span>Current value</span>
          <input
            type="number"
            value={currentValueInput}
            onChange={(e) => setCurrentValueInput(e.target.value)}
            onBlur={saveCurrentValue}
            className="w-24 rounded-lg bg-neutral-800 px-2 py-1 text-neutral-200 outline-none"
          />
          <span>/ {targetValue}</span>
        </div>
      )}

      {showManualControl && (
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span>Manual progress</span>
          <input
            type="number"
            min={0}
            max={100}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onBlur={saveManualProgress}
            className="w-20 rounded-lg bg-neutral-800 px-2 py-1 text-neutral-200 outline-none"
          />
          <span>%</span>
        </div>
      )}

      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="text-xs text-red-400 underline"
      >
        Delete goal
      </button>
    </div>
  );
}
