"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Note } from "./types";

export async function createNote(input: {
  content: string;
  course_id?: string | null;
  category?: string;
}): Promise<Note> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const trimmed = input.content.trim();
  if (!trimmed) throw new Error("Note content cannot be empty");

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      content: trimmed,
      course_id: input.course_id ?? null,
      category: input.category ?? "general",
    })
    .select("*")
    .single();

  if (error) throw error;

  revalidatePath("/");
  if (input.course_id) {
    revalidatePath("/academics");
    revalidatePath(`/academics/courses/${input.course_id}`);
  } else if (input.category === "goals") {
    revalidatePath("/goals");
  } else if (input.category === "health") {
    revalidatePath("/health");
  }

  return data as Note;
}

export async function updateNote(
  noteId: string,
  content: string,
  courseId?: string | null,
  category?: string
): Promise<Note> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Note content cannot be empty");

  const { data, error } = await supabase
    .from("notes")
    .update({ content: trimmed, updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw error;

  revalidatePath("/");
  if (courseId) {
    revalidatePath("/academics");
    revalidatePath(`/academics/courses/${courseId}`);
  } else if (category === "goals") {
    revalidatePath("/goals");
  } else if (category === "health") {
    revalidatePath("/health");
  }

  return data as Note;
}

export async function deleteNote(
  noteId: string,
  courseId?: string | null,
  category?: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", user.id);

  if (error) throw error;

  revalidatePath("/");
  if (courseId) {
    revalidatePath("/academics");
    revalidatePath(`/academics/courses/${courseId}`);
  } else if (category === "goals") {
    revalidatePath("/goals");
  } else if (category === "health") {
    revalidatePath("/health");
  }
}
