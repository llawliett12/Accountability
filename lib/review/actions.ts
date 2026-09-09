"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_NOTE_LENGTH = 5_000;

export async function saveReviewNote(input: { date: string; content: string }) {
  const content = input.content.trim();
  if (!content) throw new Error("Write a note before saving.");
  if (content.length > MAX_NOTE_LENGTH) {
    throw new Error(`Notes must be ${MAX_NOTE_LENGTH.toLocaleString()} characters or fewer.`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("review_notes").upsert(
    {
      user_id: user.id,
      date: input.date,
      content,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" }
  );

  if (error) throw error;

  revalidatePath("/review");
}

export async function deleteReviewNote(date: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase.from("review_notes").delete().eq("user_id", user.id).eq("date", date);
  if (error) throw error;
  revalidatePath("/review");
}
