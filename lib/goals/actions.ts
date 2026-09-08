"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { parentLevelFor } from "./engine";
import { fetchGoalsWithProgress } from "./queries";
import type { GoalLevel, GoalStatus } from "./types";

export async function createGoal(input: {
  title: string;
  level: GoalLevel;
  parent_id?: string;
  description?: string;
  start_date?: string;
  due_date?: string;
  priority?: number;
  target_value?: number;
  manual_progress?: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // A goal's parent must be exactly one level up the hierarchy (e.g. a
  // "week" goal's parent must be a "month" goal) — enforced here rather
  // than with a DB trigger, per "do not overcomplicate the model".
  if (input.parent_id) {
    const { data: parent, error: parentErr } = await supabase
      .from("goals")
      .select("id, level, user_id")
      .eq("id", input.parent_id)
      .single();
    if (parentErr) throw parentErr;
    if (parent.user_id !== user.id) throw new Error("Parent goal not found");
    const expectedParentLevel = parentLevelFor(input.level);
    if (!expectedParentLevel || parent.level !== expectedParentLevel) {
      throw new Error(
        `A "${input.level}" goal's parent must be a "${expectedParentLevel ?? "none"}" goal`
      );
    }
  }

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      parent_id: input.parent_id ?? null,
      level: input.level,
      title: input.title,
      description: input.description ?? null,
      start_date: input.start_date ?? null,
      due_date: input.due_date ?? null,
      priority: input.priority ?? 3,
      target_value: input.target_value ?? null,
      manual_progress: input.manual_progress ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  await recomputeAndStoreProgress(user.id);
  revalidatePath("/goals");
  revalidatePath("/");
  return data.id as string;
}

export async function updateGoal(
  goalId: string,
  input: {
    title?: string;
    description?: string;
    start_date?: string | null;
    due_date?: string | null;
    priority?: number;
    status?: GoalStatus;
    target_value?: number | null;
    current_value?: number | null;
    manual_progress?: number | null;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("goals")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", goalId)
    .eq("user_id", user.id);
  if (error) throw error;

  await recomputeAndStoreProgress(user.id);
  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/");
}

export async function deleteGoal(goalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Child goals cascade via the FK (on delete cascade); linked tasks keep
  // existing via goal_id -> set null, so task history is never destroyed.
  const { error } = await supabase.from("goals").delete().eq("id", goalId).eq("user_id", user.id);
  if (error) throw error;

  await recomputeAndStoreProgress(user.id);
  revalidatePath("/goals");
  revalidatePath("/plan");
  revalidatePath("/");
}

// Links (or unlinks, with goalId = null) a daily task to a goal. Called from
// the Plan screen — this is the "minimum integration" connecting goals to
// the existing planner without rebuilding it.
export async function linkTaskToGoal(taskId: string, goalId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (goalId) {
    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .select("id")
      .eq("id", goalId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (goalError) throw goalError;
    if (!goal) throw new Error("Goal not found");
  }

  const { error } = await supabase
    .from("tasks")
    .update({ goal_id: goalId })
    .eq("id", taskId)
    .eq("user_id", user.id);
  if (error) throw error;

  await recomputeAndStoreProgress(user.id);
  revalidatePath("/plan");
  revalidatePath("/goals");
  revalidatePath("/");
}

// Recomputes every one of the user's goals from real children/target-current
// values/linked tasks (lib/goals/engine.ts) and persists the results.
// Cheap at this app's personal scale — called after any write that could
// change a goal's inputs (create/update/delete goal, link/unlink a task, or
// a linked task's status changing — see the hook in lib/actions.ts).
export async function recomputeAndStoreProgress(userId: string) {
  const supabase = await createClient();
  const goals = await fetchGoalsWithProgress(userId);

  const updates = await Promise.all(
    goals
      .filter((g) => g.computedProgress !== g.progress)
      .map((g) =>
        supabase
          .from("goals")
          .update({ progress: g.computedProgress })
          .eq("id", g.id)
          .eq("user_id", userId)
      )
  );
  const failedUpdate = updates.find((result) => result.error);
  if (failedUpdate?.error) throw failedUpdate.error;
}
