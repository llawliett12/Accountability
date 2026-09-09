"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getLocalDateISO, todayISO } from "@/lib/date";

// Duration is computed by the database (generated column), so callers never
// have to calculate it — matches the "do not make the user do the math" spec.
export async function logSleep(input: {
  date?: string;
  bedtime: string; // ISO timestamp
  wake_time: string; // ISO timestamp
  quality: number;
  poor_sleep_reason?: string;
  note?: string;
  period_type?: "night" | "daytime";
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("sleep_logs").insert(
    {
      user_id: user.id,
      date: input.date ?? getLocalDateISO(new Date(input.bedtime)),
      bedtime: input.bedtime,
      wake_time: input.wake_time,
      quality: input.quality,
      poor_sleep_reason: input.poor_sleep_reason ?? null,
      note: input.note ?? null,
      period_type: input.period_type ?? "night",
    }
  );
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/review");
  revalidatePath("/weekly");
  revalidatePath("/monthly");
}

export async function saveFoodHabits(input: {
  date?: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase.from("food_habits").upsert({
    user_id: user.id,
    date: input.date ?? todayISO(),
    breakfast: input.breakfast,
    lunch: input.lunch,
    dinner: input.dinner,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,date" });
  if (error) throw error;
  revalidatePath("/review");
}

export async function deleteSleepPeriod(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase.from("sleep_logs").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/review");
}

export async function logMeditation(input: {
  date?: string;
  happened: boolean;
  duration_min?: number;
  type?: string;
  mood_before?: number;
  mood_after?: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("meditation_logs").upsert(
    {
      user_id: user.id,
      date: input.date ?? todayISO(),
      happened: input.happened,
      duration_min: input.duration_min ?? null,
      type: input.type ?? null,
      mood_before: input.mood_before ?? null,
      mood_after: input.mood_after ?? null,
    },
    { onConflict: "user_id,date" }
  );
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/weekly");
  revalidatePath("/monthly");
}

// One/two-tap mood+energy check-in. Multiple per day are allowed (mood
// fluctuates); dashboards average them per day.
export async function logMood(input: {
  mood: number;
  energy: number;
  notes?: string;
  clientId?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("mood_logs").upsert(
    {
      user_id: user.id,
      date: todayISO(),
      mood: input.mood,
      energy: input.energy,
      notes: input.notes ?? null,
      client_id: input.clientId ?? null,
    },
    input.clientId ? { onConflict: "user_id,client_id", ignoreDuplicates: true } : undefined
  );
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/weekly");
  revalidatePath("/monthly");
}
