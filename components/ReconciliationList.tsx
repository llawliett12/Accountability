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
      <p className="text-xs text-neutral-500 font-mono py-2">
        ✓ All tasks today have a clear status. Nothing to reconcile.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-neutral-800/80 rounded-lg bg-neutral-950/40">
      <table className="w-full text-left text-xs border-collapse min-w-[340px]">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
            <th className="py-2 px-3">Unreconciled Task</th>
            <th className="py-2 px-3 text-right">Reason / Resolution</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/60">
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-neutral-900/50 transition-colors">
              <td className="py-2.5 px-3">
                <span className="font-medium text-neutral-200">{task.title}</span>
                <span className="text-[10px] text-neutral-500 font-mono ml-2">
                  ({task.status.replace("_", " ")})
                </span>
              </td>
              <td className="py-2 px-3 text-right">
                <select
                  disabled={pending}
                  defaultValue=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    startTransition(() =>
                      reconcileTask(
                        task.id,
                        e.target.value as Parameters<typeof reconcileTask>[1]
                      )
                    );
                  }}
                  className="rounded bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs text-neutral-200 outline-none cursor-pointer"
                >
                  <option value="" disabled>
                    Select resolution...
                  </option>
                  {ANSWERS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
