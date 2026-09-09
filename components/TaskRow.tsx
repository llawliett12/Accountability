"use client";

import { useState, useTransition } from "react";
import { updateTaskStatus, deleteTask } from "@/lib/actions";
import { newClientId, runOrQueue } from "@/lib/offline/client";
import type { Task } from "@/lib/types";

const STATUS_SELECT_OPTIONS: { value: Task["status"]; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "partial", label: "Partial" },
  { value: "skipped", label: "Skipped" },
];

export default function TaskRow({
  task,
  goalTitle,
  isOptimistic,
  showPriorityBadge = true,
  onDeleted,
}: {
  task: Task;
  goalTitle?: string;
  isOptimistic?: boolean;
  showPriorityBadge?: boolean;
  onDeleted?: (taskId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<Task["status"] | null>(null);
  const [queuedLabel, setQueuedLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentStatus = optimisticStatus ?? task.status;
  const isCompleted = currentStatus === "completed";

  const handleStatusChange = (status: Task["status"]) => {
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

  const toggleComplete = () => {
    if (pending || isOptimistic || isDeleting) return;
    handleStatusChange(isCompleted ? "not_started" : "completed");
  };

  const handleDelete = () => {
    if (isDeleting || pending || isOptimistic) return;
    setIsDeleting(true);
    startTransition(async () => {
      try {
        await deleteTask(task.id);
        onDeleted?.(task.id);
      } catch {
        setIsDeleting(false);
        setError("Failed to delete task.");
      }
    });
  };

  return (
    <li
      className={`group relative rounded-xl bg-neutral-900/90 border border-neutral-800/60 p-3 transition-all ${
        isCompleted ? "bg-neutral-950/40 border-neutral-900" : "hover:border-neutral-700/70"
      } ${isOptimistic ? "border-amber-500/40 opacity-80 animate-pulse" : ""} ${
        isDeleting ? "opacity-30 pointer-events-none" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Direct manipulation checkbox with 44x44px minimum touch target */}
        <button
          type="button"
          disabled={pending || isOptimistic || isDeleting}
          onClick={toggleComplete}
          aria-label={isCompleted ? "Mark task incomplete" : "Mark task complete"}
          className="flex h-11 w-11 shrink-0 -m-2 items-center justify-center rounded-lg text-neutral-400 hover:text-white disabled:opacity-50"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
              isCompleted
                ? "bg-emerald-500 border-emerald-500 text-black"
                : "border-neutral-600 bg-neutral-800/60 group-hover:border-neutral-400"
            }`}
          >
            {isCompleted && (
              <svg
                className="h-3.5 w-3.5 stroke-[3]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
        </button>

        {/* Task content */}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <span
              onClick={toggleComplete}
              className={`cursor-pointer break-words text-sm transition-colors ${
                isCompleted
                  ? "line-through text-neutral-500"
                  : task.is_top3
                  ? "font-medium text-amber-300"
                  : "text-neutral-100"
              }`}
            >
              {task.title}
            </span>

            {/* Status Selector & Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              {isOptimistic ? (
                <span className="rounded-md bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 text-[11px] font-mono text-amber-300">
                  saving...
                </span>
              ) : (
                <select
                  value={currentStatus}
                  disabled={pending || isDeleting}
                  aria-label="Change status"
                  onChange={(e) => handleStatusChange(e.target.value as Task["status"])}
                  className={`rounded-md bg-neutral-800/80 px-2 py-1 text-[11px] font-medium transition-colors outline-none cursor-pointer ${
                    isCompleted
                      ? "text-emerald-400 border border-emerald-900/50"
                      : currentStatus === "in_progress"
                      ? "text-blue-400 border border-blue-900/50"
                      : currentStatus === "skipped"
                      ? "text-neutral-500 border border-neutral-800"
                      : "text-neutral-300 border border-neutral-700/60"
                  }`}
                >
                  {STATUS_SELECT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Quick Delete action with expanded 38x38px hit target and subtle icon */}
              <button
                type="button"
                onClick={handleDelete}
                title="Delete task"
                aria-label="Delete task"
                disabled={pending || isDeleting}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800/70 active:bg-neutral-800 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Badges / metadata */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-400">
            {showPriorityBadge && task.is_top3 && (
              <span className="rounded bg-amber-950/60 border border-amber-800/50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                ★ TOP 3
              </span>
            )}
            {task.planned_duration_min ? (
              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                ⏱ {task.planned_duration_min}m
              </span>
            ) : null}
            {task.planned_start && (
              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                🕒 {task.planned_start.slice(0, 5)}
                {task.planned_end ? ` - ${task.planned_end.slice(0, 5)}` : ""}
              </span>
            )}
            {goalTitle && (
              <span className="rounded bg-neutral-800/80 px-1.5 py-0.5 text-[10px] text-neutral-300 truncate max-w-[160px]">
                🎯 {goalTitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {queuedLabel && <p className="mt-1.5 text-xs text-amber-400 pl-8">{queuedLabel}</p>}
      {error && <p className="mt-1.5 text-xs text-red-400 pl-8">{error}</p>}
    </li>
  );
}
