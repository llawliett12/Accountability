"use client";

import { useTransition } from "react";
import { updateDeadlineStatus } from "@/lib/academics/actions";
import type { Deadline } from "@/lib/academics/types";

export default function DeadlineRow({ deadline }: { deadline: Deadline }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(() =>
      updateDeadlineStatus(deadline.id, deadline.status === "completed" ? "pending" : "completed")
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-neutral-900 p-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${deadline.status === "completed" ? "text-neutral-500 line-through" : ""}`}>
          {deadline.title}
        </p>
        <p className="text-xs text-neutral-500">{deadline.due_date}</p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`shrink-0 min-h-[44px] rounded-xl px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
          deadline.status === "completed"
            ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
            : "bg-white text-neutral-950 font-semibold hover:bg-neutral-200"
        }`}
      >
        {deadline.status === "completed" ? "Reopen" : "Mark done"}
      </button>
    </div>
  );
}
