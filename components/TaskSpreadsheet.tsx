"use client";

import { useState, useTransition, useRef } from "react";
import { updateTask, updateTaskStatus, deleteTask, createTask } from "@/lib/actions";
import { newClientId, runOrQueue } from "@/lib/offline/client";
import type { Task } from "@/lib/types";
import { sortTasks, DEFAULT_TASK_PRIORITY } from "@/lib/tasks";
import PrioritySelect from "@/components/PrioritySelect";

export interface LinkableGoal {
  id: string;
  title: string;
  level: string;
}

export interface TaskSpreadsheetProps {
  initialTasks: Task[];
  /** Every active goal, so any task can be linked to any goal. */
  goals?: LinkableGoal[];
  selectedDate?: string;
}

export default function TaskSpreadsheet({
  initialTasks,
  goals = [],
  selectedDate,
}: TaskSpreadsheetProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [, startTransition] = useTransition();

  // Inline Quick Add state
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<number>(DEFAULT_TASK_PRIORITY);
  const [newDuration, setNewDuration] = useState<number | undefined>(undefined);
  const [newGoalId, setNewGoalId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Swipe gesture tracking per row
  const [touchState, setTouchState] = useState<{
    taskId: string | null;
    startX: number;
    currentX: number;
  }>({ taskId: null, startX: 0, currentX: 0 });

  // Map of goal titles (used to tell a still-active goal from a completed one)
  const goalTitleById = new Map(goals.map((g) => [g.id, g.title]));

  // Re-sync tasks if initialTasks prop changes
  const [prevInitial, setPrevInitial] = useState(initialTasks);
  if (prevInitial !== initialTasks) {
    setPrevInitial(initialTasks);
    setTasks(initialTasks);
  }

  // Vibration helper
  const triggerHaptic = (ms = 12) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignore unsupported
      }
    }
  };

  // Status Change handler with optimistic update
  const handleStatusChange = (task: Task, newStatus: Task["status"]) => {
    if (task.status === newStatus) return;
    triggerHaptic(10);
    const oldStatus = task.status;

    // Optimistic local update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );

    const clientId = newClientId();
    startTransition(async () => {
      const res = await runOrQueue(
        "task_status",
        { taskId: task.id, status: newStatus },
        () => updateTaskStatus(task.id, newStatus, clientId),
        clientId
      );

      if (res.status === "error") {
        // Rollback
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: oldStatus } : t))
        );
      }
    });
  };

  // Priority (P1–P5) change with optimistic update + rollback
  const handlePriorityChange = (task: Task, priority: number) => {
    if (task.priority === priority) return;
    triggerHaptic(10);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, priority } : t)));
    startTransition(async () => {
      try {
        await updateTask(task.id, { priority });
      } catch {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, priority: task.priority } : t))
        );
      }
    });
  };

  // Link / unlink a task to any active goal
  const handleGoalChange = (task: Task, goalId: string) => {
    const next = goalId || null;
    if ((task.goal_id ?? null) === next) return;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, goal_id: next } : t)));
    startTransition(async () => {
      try {
        await updateTask(task.id, { goal_id: next });
      } catch {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, goal_id: task.goal_id } : t))
        );
      }
    });
  };

  // Delete handler with optimistic removal
  const handleDelete = (taskId: string) => {
    triggerHaptic(20);
    const taskToDelete = tasks.find((t) => t.id === taskId);
    if (!taskToDelete) return;

    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    startTransition(async () => {
      try {
        await deleteTask(taskId);
      } catch {
        // Rollback
        setTasks((prev) => [...prev, taskToDelete]);
      }
    });
  };

  const handleEditTitle = (task: Task) => {
    const title = prompt("Edit task", task.title);
    if (title === null || !title.trim() || title.trim() === task.title) return;
    const previous = tasks;
    setTasks((rows) => rows.map((row) => row.id === task.id ? { ...row, title: title.trim() } : row));
    startTransition(async () => {
      try { await updateTask(task.id, { title: title.trim() }); }
      catch { setTasks(previous); }
    });
  };

  // Inline Quick Add submit
  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || isAdding) return;

    triggerHaptic(10);
    setAddError(null);
    setIsAdding(true);

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optTask: Task = {
      id: tempId,
      user_id: "",
      daily_plan_id: "",
      title: trimmed,
      status: "not_started",
      priority: newPriority,
      goal_id: newGoalId || null,
      category: null,
      planned_duration_min: newDuration ?? null,
      planned_start: null,
      planned_end: null,
      deadline: null,
      notes: null,
    };

    // Optimistic insert at top
    setTasks((prev) => [optTask, ...prev]);
    setNewTitle("");

    try {
      const created = await createTask({
        title: trimmed,
        priority: newPriority,
        goal_id: newGoalId || undefined,
        planned_duration_min: newDuration,
        date: selectedDate,
      });

      // Replace temp task with real created task
      setTasks((prev) =>
        prev.map((t) => (t.id === tempId ? (created as unknown as Task) : t))
      );
    } catch {
      // Rollback
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setNewTitle(trimmed);
      setAddError("Could not add task. Try again.");
    } finally {
      setIsAdding(false);
      inputRef.current?.focus();
    }
  };

  // Touch Swipe Handlers for Mobile
  const handleTouchStart = (taskId: string, e: React.TouchEvent) => {
    setTouchState({
      taskId,
      startX: e.touches[0].clientX,
      currentX: e.touches[0].clientX,
    });
  };

  const handleTouchMove = (taskId: string, e: React.TouchEvent) => {
    if (touchState.taskId !== taskId) return;
    setTouchState((prev) => ({
      ...prev,
      currentX: e.touches[0].clientX,
    }));
  };

  const handleTouchEnd = (task: Task) => {
    if (touchState.taskId !== task.id) return;
    const diff = touchState.currentX - touchState.startX;

    if (diff > 75 && task.status !== "completed") {
      // Swipe right: complete unfinished work. Completion keeps the same
      // optimistic update, rollback, and haptic feedback as the checkbox.
      handleStatusChange(task, "completed");
    }

    setTouchState({ taskId: null, startX: 0, currentX: 0 });
  };

  // Open tasks first, P1 → P5; finished tasks sink to the bottom.
  const sortedTasks = sortTasks(tasks);

  const totalCount = sortedTasks.length;
  const completedCount = sortedTasks.filter((t) => t.status === "completed").length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllDone = totalCount > 0 && completedCount === totalCount;

  return (
    <div className="space-y-2">
      {/* COMPACT SECTION HEADER & SUMMARY LEDGER */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold uppercase tracking-wider text-neutral-300">
            Tasks
          </span>
          <span className="font-mono text-xs text-neutral-500">
            [{completedCount}/{totalCount}] · {pct}%
          </span>
        </div>

        {/* Progress Bar & Dopamine indicator */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 sm:w-32 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isAllDone ? "bg-emerald-400" : "bg-amber-400"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {isAllDone && (
            <span className="text-xs font-mono font-semibold text-emerald-400 animate-pulse">
              ⚡ All Done
            </span>
          )}
        </div>
      </div>

      {addError && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-800/40 px-3 py-1.5 rounded">
          {addError}
        </div>
      )}

      {/* SPREADSHEET TABLE CONTAINER */}
      <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
        <table className="w-full text-left text-sm border-collapse min-w-[500px]">
          {/* TABLE HEADER */}
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/80 text-xs font-mono uppercase tracking-wider text-neutral-400">
              <th className="py-2 px-2.5 w-8 text-center">#</th>
              <th className="py-2 px-1.5 w-9 text-center">✓</th>
              <th className="py-2 px-1.5 w-16 text-center">P</th>
              <th className="py-2 px-3">Task</th>
              <th className="py-2 px-2 w-16 text-center">Est</th>
              <th className="py-2 px-2 w-28 text-left">Goal</th>
              <th className="py-2 px-2 w-28 text-left">Status</th>
              <th className="py-2 px-2 w-10 text-center"></th>
            </tr>

            {/* INLINE QUICK ADD ROW (Top of Table) */}
            <tr className="border-b border-neutral-800/90 bg-neutral-900/40 hover:bg-neutral-900/70 transition-colors">
                <td className="py-2 px-2.5 text-center font-mono text-xs text-amber-400/80">
                  +
                </td>
                <td className="py-2 px-1.5 text-center">
                  <span className="text-neutral-600 font-mono text-sm">·</span>
                </td>
                <td className="py-2 px-1.5 text-center">
                  <PrioritySelect value={newPriority} onChange={setNewPriority} label="New task priority" />
                </td>
                <td className="py-1.5 px-3">
                  <form onSubmit={handleQuickAdd} className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Add task row (press Enter to save)..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-transparent text-neutral-100 placeholder:text-neutral-600 text-sm outline-none py-1"
                    />
                  </form>
                </td>
                <td className="py-1.5 px-2">
                  <select
                    value={newDuration ?? ""}
                    onChange={(e) =>
                      setNewDuration(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="w-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-400 rounded px-1 py-1 outline-none"
                  >
                    <option value="">--</option>
                    <option value="15">15m</option>
                    <option value="30">30m</option>
                    <option value="45">45m</option>
                    <option value="60">1h</option>
                    <option value="90">1.5h</option>
                    <option value="120">2h</option>
                  </select>
                </td>
                <td className="py-1.5 px-2">
                  <select
                    value={newGoalId}
                    onChange={(e) => setNewGoalId(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 rounded px-1 py-1 outline-none truncate"
                  >
                    <option value="">No goal</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 px-2">
                  <button
                    type="button"
                    disabled={isAdding || !newTitle.trim()}
                    onClick={() => handleQuickAdd()}
                    className="w-full rounded bg-white hover:bg-neutral-200 text-neutral-950 px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-30 whitespace-nowrap"
                  >
                    {isAdding ? "..." : "+ Add"}
                  </button>
                </td>
                <td className="py-2 px-2"></td>
              </tr>
          </thead>

          {/* TABLE BODY */}
          <tbody className="divide-y divide-neutral-800/60">
            {sortedTasks.map((task, idx) => {
              const isCompleted = task.status === "completed";
              const isUrgent = !isCompleted && task.priority === 1;
              const isTemp = task.id.startsWith("temp-");
              const isSwiping = touchState.taskId === task.id;
              const swipeDiff = isSwiping ? touchState.currentX - touchState.startX : 0;

              return (
                <tr
                  key={task.id}
                  onTouchStart={(e) => handleTouchStart(task.id, e)}
                  onTouchMove={(e) => handleTouchMove(task.id, e)}
                  onTouchEnd={() => handleTouchEnd(task)}
                  style={{
                    transform: isSwiping ? `translateX(${Math.max(0, swipeDiff) * 0.4}px)` : undefined,
                    transition: isSwiping ? "none" : "transform 0.2s ease",
                  }}
                  className={`group transition-colors ${
                    isCompleted
                      ? "bg-neutral-950/60 hover:bg-neutral-900/40"
                      : isUrgent
                      ? "bg-amber-950/15 hover:bg-amber-950/25"
                      : "hover:bg-neutral-900/50"
                  } ${isTemp ? "opacity-60 animate-pulse" : ""}`}
                >
                  {/* # Priority Index */}
                  <td className="py-2.5 px-2.5 text-center font-mono text-xs">
                    <span
                      className={`${
                        isUrgent
                          ? "text-amber-400 font-semibold"
                          : "text-neutral-600"
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </td>

                  {/* Direct Checkbox */}
                  <td className="py-2 px-1.5 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusChange(
                          task,
                          isCompleted ? "not_started" : "completed"
                        )
                      }
                      aria-label={isCompleted ? "Mark uncompleted" : "Mark completed"}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center -m-2 group/cb"
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border transition-transform group-active/cb:scale-90 ${
                          isCompleted
                            ? "bg-emerald-500 border-emerald-500 text-black shadow-sm"
                            : "border-neutral-700 bg-neutral-900 hover:border-neutral-500"
                        }`}
                      >
                        {isCompleted && (
                          <svg
                            className="h-3 w-3 stroke-[3]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </span>
                    </button>
                  </td>

                  {/* Priority P1–P5 */}
                  <td className="py-2 px-1.5 text-center">
                    <PrioritySelect
                      value={task.priority ?? DEFAULT_TASK_PRIORITY}
                      onChange={(p) => handlePriorityChange(task, p)}
                      disabled={isTemp}
                      label={`Priority for ${task.title}`}
                    />
                  </td>

                  {/* Task Title */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        onDoubleClick={() => handleEditTitle(task)}
                        className={`cursor-pointer break-words transition-colors ${
                          isCompleted
                            ? "line-through text-neutral-500"
                            : isUrgent
                            ? "font-medium text-amber-200"
                            : "text-neutral-200"
                        }`}
                      >
                        {task.title}
                      </span>
                      <button type="button" onClick={() => handleEditTitle(task)} className="min-h-9 px-1 text-xs text-neutral-600 hover:text-amber-400" aria-label={`Edit ${task.title}`}>Edit</button>
                      {isTemp && (
                        <span className="text-[11px] font-mono text-amber-400/80 border border-amber-800/40 rounded px-1">
                          syncing
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Duration Est */}
                  <td className="py-2.5 px-2 text-center font-mono text-xs text-neutral-400 whitespace-nowrap">
                    {task.planned_duration_min ? (
                      <span className="text-neutral-300">
                        {task.planned_duration_min}m
                      </span>
                    ) : (
                      <span className="text-neutral-700">--</span>
                    )}
                  </td>

                  {/* Linked Goal (any active goal) */}
                  <td className="py-2.5 px-2 text-neutral-400 whitespace-nowrap">
                    <select
                      value={task.goal_id ?? ""}
                      disabled={isTemp}
                      onChange={(e) => handleGoalChange(task, e.target.value)}
                      aria-label={`Goal for ${task.title}`}
                      className="w-full max-w-[110px] truncate bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 rounded px-1 py-1 outline-none cursor-pointer"
                    >
                      <option value="">--</option>
                      {task.goal_id && !goalTitleById.has(task.goal_id) && (
                        <option value={task.goal_id}>🎯 Linked goal</option>
                      )}
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Status Pill / Dropdown */}
                  <td className="py-2 px-2 whitespace-nowrap">
                    <select
                      value={task.status}
                      onChange={(e) =>
                        handleStatusChange(task, e.target.value as Task["status"])
                      }
                      className={`rounded px-1.5 py-0.5 text-xs font-medium outline-none cursor-pointer transition-colors ${
                        isCompleted
                          ? "bg-emerald-950/70 border border-emerald-800/60 text-emerald-300"
                          : task.status === "in_progress"
                          ? "bg-blue-950/70 border border-blue-800/60 text-blue-300"
                          : task.status === "partial"
                          ? "bg-amber-950/70 border border-amber-800/60 text-amber-300"
                          : task.status === "skipped"
                          ? "bg-neutral-900 border border-neutral-800 text-neutral-500"
                          : "bg-neutral-900 border border-neutral-800 text-neutral-400"
                      }`}
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                      <option value="partial">Partial</option>
                      <option value="skipped">Skipped</option>
                    </select>
                  </td>

                  {/* Delete Action */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleDelete(task.id)}
                      title="Delete task row"
                      aria-label="Delete task row"
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center -m-2 text-neutral-600 hover:text-red-400 transition-colors"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}

            {sortedTasks.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-6 text-center text-sm text-neutral-500 font-mono"
                >
                  No tasks recorded for this day. Enter a title above to add a row.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Swipe instructions on mobile */}
      <div className="sm:hidden flex items-center justify-end text-xs font-mono text-neutral-500 px-1">
        <span>→ Swipe right to complete</span>
      </div>
    </div>
  );
}
