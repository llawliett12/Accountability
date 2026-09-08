"use client";

import { useOptimistic, useTransition } from "react";
import TaskQuickAdd, { LinkableGoal } from "./TaskQuickAdd";
import TaskRow from "./TaskRow";
import { createTask } from "@/lib/actions";
import type { Task } from "@/lib/types";

export interface OptimisticTask extends Task {
  isOptimistic?: boolean;
}

export default function PlanTaskList({
  initialTasks,
  goals = [],
}: {
  initialTasks: Task[];
  goals: LinkableGoal[];
}) {
  const [, startTransition] = useTransition();
  const [optimisticTasks, addOptimisticTask] = useOptimistic(
    initialTasks as OptimisticTask[],
    (state, newTask: OptimisticTask) => [newTask, ...state]
  );

  const goalTitleById = new Map(goals.map((g) => [g.id, g.title]));

  const handleOptimisticCreate = async (input: {
    title: string;
    is_top3: boolean;
    goal_id?: string;
  }) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optTask: OptimisticTask = {
      id: tempId,
      user_id: "",
      daily_plan_id: "",
      title: input.title,
      status: "not_started",
      priority: 3,
      is_top3: input.is_top3,
      goal_id: input.goal_id ?? null,
      category: null,
      planned_duration_min: null,
      planned_start: null,
      planned_end: null,
      deadline: null,
      notes: null,
      isOptimistic: true,
    };

    return new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        addOptimisticTask(optTask);
        try {
          await createTask({
            title: input.title,
            is_top3: input.is_top3,
            goal_id: input.goal_id,
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  };

  return (
    <div className="space-y-4">
      <TaskQuickAdd goals={goals} onOptimisticCreate={handleOptimisticCreate} />

      <ul className="space-y-2">
        {optimisticTasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            goalTitle={t.goal_id ? goalTitleById.get(t.goal_id) : undefined}
            isOptimistic={t.isOptimistic}
          />
        ))}
        {optimisticTasks.length === 0 && (
          <p className="text-sm text-neutral-500">
            No tasks yet — add your first one above.
          </p>
        )}
      </ul>
    </div>
  );
}
