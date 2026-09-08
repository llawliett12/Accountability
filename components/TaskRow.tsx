"use client";

import { useState, useTransition } from "react";
import { updateTaskStatus } from "@/lib/actions";
import { newClientId, runOrQueue } from "@/lib/offline/client";
import type { Task } from "@/lib/types";

const STATUS_OPTIONS: { value: Task["status"]; label: string }[] = [
  { value: "in_progress", label: "Start" },
  { value: "completed", label: "Done" },
  { value: "partial", label: "Partial" },
  { value: "skipped", label: "Skip" },
];

export default function TaskRow({
  task,
  goalTitle,
  isOptimistic,
}: {
  task: Task;
  goalTitle?: string;
  isOptimistic?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<Task["status"] | null>(null);
  const [queuedLabel, setQueuedLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentStatus = optimisticStatus ?? task.status;

  const handleStatusClick = (status: Task["status"]) => {
    if (status === currentStatus) return;
    setQueuedLabel(null);
    setError(null);
    const previousStatus = currentStatus;
    setOptimisticStatus(status);
    const clientId = newClientId();

    startTransition(async () => {
      const result = await runOrQueue("task_status", { taskId: task.id, status }, () =>
        updateTaskStatus(task.id, status, clientId),
        clientId
      );
      if (result.status === "queued") {
        setQueuedLabel(`"${status.replace("_", " ")}" saved offline — will sync`);
      } else if (result.status === "error") {
        setOptimisticStatus(previousStatus);
        setError("Couldn't update this task. Please try again.");
      } else {
        setOptimisticStatus(null);
      }
    });
  };

  return (
    <li
      className={`rounded-2xl bg-neutral-900 p-3 transition-opacity ${
        isOptimistic ? "border border-neutral-800/80 opacity-80 animate-pulse" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`break-words min-w-0 flex-1 ${task.is_top3 ? "font-medium text-amber-400" : ""}`}>
          {task.is_top3 && "★ "}
          {task.title}
        </span>
        <span
          className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-mono ${
            isOptimistic
              ? "bg-amber-950/60 border border-amber-800/50 text-amber-300"
              : "bg-neutral-800/80 text-neutral-400"
          }`}
        >
          {isOptimistic ? "saving..." : currentStatus.replace("_", " ")}
        </span>
      </div>
      {goalTitle && (
        <p className="mt-1 text-xs text-neutral-500 truncate">
          <span className="rounded bg-neutral-800 px-1.5 py-0.5">🎯 {goalTitle}</span>
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = currentStatus === opt.value;
          return (
            <button
              key={opt.value}
              disabled={pending || isOptimistic}
              onClick={() => handleStatusClick(opt.value)}
              className={`min-h-[44px] min-w-[56px] flex-1 inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                isActive
                  ? "bg-white text-neutral-950 font-semibold"
                  : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700 active:bg-neutral-600"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {queuedLabel && <p className="mt-1 text-xs text-amber-400">{queuedLabel}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </li>
  );
}
