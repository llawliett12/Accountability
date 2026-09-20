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
  revalidatePath("/health");
}

export async function addFoodEntry(input: {
  date?: string;
  entry: { id?: string; time: string; food: string; notes?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const date = input.date ?? todayISO();
  const newEntry = {
    id: input.entry.id ?? crypto.randomUUID(),
    time: input.entry.time.trim(),
    food: input.entry.food.trim(),
    notes: input.entry.notes?.trim() || "",
  };

  const { data: existing } = await supabase
    .from("food_habits")
    .select("entries")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  const currentEntries = ((existing?.entries as unknown[]) ?? []) as {
    id: string;
    time: string;
    food: string;
    notes?: string;
  }[];
  const updatedEntries = [...currentEntries, newEntry];

  const { error } = await supabase.from("food_habits").upsert(
    {
      user_id: user.id,
      date,
      entries: updatedEntries,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" }
  );

  if (error) throw error;
  revalidatePath("/health");
  revalidatePath("/review");
  return newEntry;
}

export async function deleteFoodEntry(input: { date: string; entryId: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("food_habits")
    .select("entries")
    .eq("user_id", user.id)
    .eq("date", input.date)
    .maybeSingle();

  const currentEntries = ((existing?.entries as unknown[]) ?? []) as {
    id: string;
    time: string;
    food: string;
    notes?: string;
  }[];
  const updatedEntries = currentEntries.filter((e) => e.id !== input.entryId);

  const { error } = await supabase
    .from("food_habits")
    .update({ entries: updatedEntries, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("date", input.date);

  if (error) throw error;
  revalidatePath("/health");
  revalidatePath("/review");
}

export async function updateFoodEntry(input: {
  date: string;
  entry: { id: string; time: string; food: string; notes?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("food_habits")
    .select("entries")
    .eq("user_id", user.id)
    .eq("date", input.date)
    .maybeSingle();

  const currentEntries = ((existing?.entries as unknown[]) ?? []) as {
    id: string;
    time: string;
    food: string;
    notes?: string;
  }[];
  const updatedEntries = currentEntries.map((e) =>
    e.id === input.entry.id
      ? {
          ...e,
          time: input.entry.time.trim(),
          food: input.entry.food.trim(),
          notes: input.entry.notes?.trim() || "",
        }
      : e
  );

  const { error } = await supabase
    .from("food_habits")
    .update({ entries: updatedEntries, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("date", input.date);

  if (error) throw error;
  revalidatePath("/health");
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

  const date = input.date ?? todayISO();
  const { data, error } = await supabase.from("meditation_logs").upsert(
    {
      user_id: user.id,
      date,
      happened: input.happened,
      duration_min: input.duration_min ?? null,
      type: input.type ?? null,
      mood_before: input.mood_before ?? null,
      mood_after: input.mood_after ?? null,
    },
    { onConflict: "user_id,date" }
  ).select("id, date, happened, duration_min").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Meditation status was not saved");

  revalidatePath("/");
  revalidatePath("/review");
  revalidatePath("/weekly");
  revalidatePath("/monthly");
  return data;
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
