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
    <div className="flex items-center justify-between rounded-xl bg-neutral-900 p-3 text-sm">
      <div>
        <p className={deadline.status === "completed" ? "text-neutral-500 line-through" : ""}>
          {deadline.title}
        </p>
        <p className="text-xs text-neutral-500">{deadline.due_date}</p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`rounded-lg px-2.5 py-1 text-xs ${
          deadline.status === "completed"
            ? "bg-neutral-800 text-neutral-400"
            : "bg-white text-neutral-950"
        }`}
      >
        {deadline.status === "completed" ? "Reopen" : "Mark done"}
      </button>
    </div>
  );
}
