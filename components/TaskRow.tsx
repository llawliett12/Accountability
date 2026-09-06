"use client";

import { useState, useTransition } from "react";
import { updateTaskStatus } from "@/lib/actions";
import { runOrQueue } from "@/lib/offline/client";
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
}: {
  task: Task;
  goalTitle?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [queuedLabel, setQueuedLabel] = useState<string | null>(null);

  const handleStatusClick = (status: Task["status"]) => {
    setQueuedLabel(null);
    startTransition(async () => {
      const result = await runOrQueue("task_status", { taskId: task.id, status }, () =>
        updateTaskStatus(task.id, status)
      );
      if (result.status === "queued") {
        // The task's visible status won't update until sync (no local
        // optimistic row state here), but the click itself is never lost —
        // surface that plainly instead of pretending it saved to the server.
        setQueuedLabel(`"${status}" saved offline — will sync`);
      }
    });
  };

  return (
    <li className="rounded-2xl bg-neutral-900 p-3">
      <div className="flex items-center justify-between">
        <span className={task.is_top3 ? "font-medium text-amber-400" : ""}>
          {task.is_top3 && "★ "}
          {task.title}
        </span>
        <span className="text-xs text-neutral-500">{task.status}</span>
      </div>
      {goalTitle && (
        <p className="mt-1 text-xs text-neutral-500">
          <span className="rounded bg-neutral-800 px-1.5 py-0.5">🎯 {goalTitle}</span>
        </p>
      )}
      <div className="mt-2 flex gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            disabled={pending}
            onClick={() => handleStatusClick(opt.value)}
            className="rounded-lg bg-neutral-800 px-2 py-1 text-xs text-neutral-200"
          >
            {opt.label}
          </button>
        ))}
      </div>
      {queuedLabel && <p className="mt-1 text-xs text-amber-400">{queuedLabel}</p>}
    </li>
  );
}
