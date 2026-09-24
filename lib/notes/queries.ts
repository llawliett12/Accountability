import { createClient } from "@/lib/supabase/server";
import type { Note } from "./types";

export async function fetchNotes(
  userId: string,
  options?: { courseId?: string | null; category?: string }
): Promise<Note[]> {
  const supabase = await createClient();
  let query = supabase
    .from("notes")
    .select("id, user_id, content, course_id, category, created_at, updated_at")
    .eq("user_id", userId);

  if (options?.courseId) {
    query = query.eq("course_id", options.courseId);
  } else if (options?.category) {
    query = query.is("course_id", null).eq("category", options.category);
  } else {
    query = query.is("course_id", null);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.warn("fetchNotes non-fatal notice:", error.message);
    return [];
  }
  return (data ?? []) as Note[];
}
