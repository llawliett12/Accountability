"use client";

import { useTransition } from "react";
import { reconcileTask } from "@/lib/actions";
import type { Task } from "@/lib/types";

const ANSWERS: { value: Parameters<typeof reconcileTask>[1]; label: string }[] = [
  { value: "did_but_forgot", label: "Did it, forgot to track" },
  { value: "didnt_do", label: "Didn't do it" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "did_something_else", label: "Did something else" },
  { value: "unexpected_event", label: "Unexpected event" },
];

export default function ReconciliationList({ tasks }: { tasks: Task[] }) {
  const [pending, startTransition] = useTransition();

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Everything today has a clear status. Nothing to reconcile.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <li key={task.id} className="rounded-2xl bg-neutral-900 p-3">
          <p className="mb-2 text-sm font-medium">{task.title}</p>
          <div className="grid grid-cols-1 gap-1">
            {ANSWERS.map((a) => (
              <button
                key={a.value}
                disabled={pending}
                onClick={() =>
                  startTransition(() => reconcileTask(task.id, a.value))
                }
                className="rounded-lg bg-neutral-800 py-2 text-left text-xs"
              >
                {a.label}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
