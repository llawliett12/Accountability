"use client";

import { TASK_PRIORITIES } from "@/lib/tasks";

const TONE: Record<number, string> = {
  1: "text-amber-300 border-amber-700/60 bg-amber-950/40",
  2: "text-amber-200/90 border-neutral-700 bg-neutral-900",
  3: "text-neutral-300 border-neutral-800 bg-neutral-900",
  4: "text-neutral-400 border-neutral-800 bg-neutral-900",
  5: "text-neutral-500 border-neutral-800 bg-neutral-900",
};

/**
 * The one P1–P5 priority control used for Tasks everywhere (Home top
 * priorities, the task ledger, quick-add). A native <select> keeps it fast,
 * accessible, and usable inside scrolling tables on mobile.
 */
export default function PrioritySelect({
  value,
  onChange,
  disabled,
  label = "Priority",
  className = "",
}: {
  value: number;
  onChange: (priority: number) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={label}
      title={`${label} (P1 is highest)`}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`rounded border px-1 py-0.5 font-mono text-xs outline-none cursor-pointer transition-colors ${
        TONE[value] ?? TONE[3]
      } ${className}`}
    >
      {TASK_PRIORITIES.map((p) => (
        <option key={p} value={p}>
          P{p}
        </option>
      ))}
    </select>
  );
}
