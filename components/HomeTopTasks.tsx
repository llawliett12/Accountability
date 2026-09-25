"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createTask, updateTask, updateTaskStatus } from "@/lib/actions";
import { newClientId, runOrQueue } from "@/lib/offline/client";
import { pickTopTasks, isOpenTask, DEFAULT_TASK_PRIORITY } from "@/lib/tasks";
import type { Task } from "@/lib/types";
import PrioritySelect from "@/components/PrioritySelect";

/**
 * "Top Priorities" = today's top open Tasks by P1–P5 priority.
 * Finishing one immediately promotes the next task into the list.
 */
export default function HomeTopTasks({
  tasks,
  date,
  courseCodeMap,
  onOpenTasks,
}: {
  tasks: Task[];
  date: string;
  courseCodeMap?: Record<string, string>;
  onOpenTasks?: () => void;
}) {
  const [items, setItems] = useState<Task[]>(tasks);
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (prevTasks !== tasks) {
    setPrevTasks(tasks);
    setItems(tasks);
  }

  const [, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCount = items.filter(isOpenTask).length;
  const top = pickTopTasks(items);

  function patchLocal(id: string, patch: Partial<Task>) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function complete(task: Task) {
    setError(null);
    patchLocal(task.id, { status: "completed" });
    const clientId = newClientId();
    startTransition(async () => {
      const res = await runOrQueue(
        "task_status",
        { taskId: task.id, status: "completed" },
        () => updateTaskStatus(task.id, "completed", clientId),
        clientId
      );
      if (res.status === "error") {
        patchLocal(task.id, { status: task.status });
        setError("Could not complete that task. Try again.");
      }
    });
  }

  function changePriority(task: Task, priority: number) {
    setError(null);
    patchLocal(task.id, { priority });
    startTransition(async () => {
      try {
        await updateTask(task.id, { priority });
      } catch {
        patchLocal(task.id, { priority: task.priority });
        setError("Could not change priority. Try again.");
      }
    });
  }

  async function submitNew() {
    const title = newTitle.trim();
    if (!title || saving) return;
    setError(null);
    setSaving(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic: Task = {
      id: tempId,
      user_id: "",
      daily_plan_id: "",
      title,
      status: "not_started",
      priority: newPriority,
      goal_id: null,
      category: null,
      planned_duration_min: null,
      planned_start: null,
      planned_end: null,
      deadline: null,
      notes: null,
    };
    setItems((prev) => [optimistic, ...prev]);
    setNewTitle("");
    try {
      const created = await createTask({ title, priority: newPriority, date });
      setItems((prev) => prev.map((t) => (t.id === tempId ? (created as unknown as Task) : t)));
      setIsAdding(false);
      setNewPriority(1);
    } catch {
      setItems((prev) => prev.filter((t) => t.id !== tempId));
      setNewTitle(title);
      setError("Could not add task. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const allTasksHref = `/?date=${date}&section=tasks`;

  return (
    <section aria-label="Top Priorities" className="space-y-2 pt-1">
      <div className="flex items-center justify-between border-b border-neutral-800/70 pb-2">
        <h2 className="font-mono text-xs uppercase tracking-wider text-neutral-400 font-semibold">
          Top Priorities
          {openCount > top.length && (
            <span className="ml-2 normal-case tracking-normal text-neutral-600">
              {top.length} of {openCount} open
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {!isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="font-mono text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              + Add
            </button>
          )}
          <Link
            href={allTasksHref}
            onClick={(e) => {
              if (onOpenTasks) {
                e.preventDefault();
                onOpenTasks();
              }
            }}
            className="font-mono text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            All tasks &rarr;
          </Link>
        </div>
      </div>

      {isAdding && (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-700 bg-neutral-950 p-2.5 font-mono text-sm">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitNew();
              if (e.key === "Escape") setIsAdding(false);
            }}
            placeholder="New task..."
            className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-neutral-100 placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-500">Priority:</span>
              <PrioritySelect value={newPriority} onChange={setNewPriority} />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle("");
                }}
                className="px-2 py-1 text-neutral-500 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitNew()}
                disabled={saving || !newTitle.trim()}
                className="rounded bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="font-mono text-xs text-red-400">{error}</p>}

      {top.length === 0 && !isAdding ? (
        <p className="font-mono text-sm text-neutral-500 py-1">
          {items.length > 0
            ? "All tasks done for this day. 🎉"
            : "No tasks for this day yet. Add one above."}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-800/60 font-mono text-sm">
          {top.map((task, idx) => {
            const courseCode =
              task.course_id && courseCodeMap ? courseCodeMap[task.course_id] : null;
            const isTemp = task.id.startsWith("temp-");
            return (
              <li
                key={task.id}
                className={`py-2 flex items-center gap-2.5 px-1 rounded hover:bg-neutral-800/20 transition-colors ${
                  isTemp ? "opacity-60" : ""
                }`}
              >
                <button
                  type="button"
                  disabled={isTemp}
                  onClick={() => complete(task)}
                  aria-label={`Mark "${task.title}" completed`}
                  className="min-h-[44px] min-w-[44px] -m-2 inline-flex items-center justify-center group/cb"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded border border-neutral-700 bg-neutral-900 hover:border-neutral-500 transition-transform group-active/cb:scale-90" />
                </button>

                <span className="font-bold text-amber-400/80 text-xs w-5 shrink-0">#{idx + 1}</span>
                {courseCode && (
                  <span className="rounded bg-neutral-800 px-1 text-xs text-neutral-300 shrink-0">
                    {courseCode}
                  </span>
                )}
                <span className="text-neutral-200 truncate flex-1 min-w-0">{task.title}</span>

                {task.deadline && (
                  <span className="text-xs text-neutral-400 whitespace-nowrap shrink-0">
                    Due {task.deadline.slice(5, 10)}
                  </span>
                )}
                <PrioritySelect
                  value={task.priority ?? DEFAULT_TASK_PRIORITY}
                  onChange={(p) => changePriority(task, p)}
                  disabled={isTemp}
                  label={`Priority for ${task.title}`}
                  className="shrink-0"
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
