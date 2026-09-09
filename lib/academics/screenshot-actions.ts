"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "academic-schedule-screenshots";
const KINDS = ["timetable", "quiz_schedule", "exam_schedule", "other"] as const;
export type AcademicScreenshotKind = (typeof KINDS)[number];

async function userClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function saveAcademicScheduleScreenshot(formData: FormData) {
  const kind = formData.get("kind");
  const file = formData.get("screenshot");
  if (!KINDS.includes(kind as AcademicScreenshotKind)) throw new Error("Invalid schedule type");
  if (!(file instanceof File) || !file.size) throw new Error("Choose an image to upload");
  if (file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use a JPG, PNG, or WebP image under 10MB");
  const { supabase, user } = await userClient();
  const { data: existing } = await supabase.from("academic_schedule_screenshots").select("storage_path").eq("user_id", user.id).eq("kind", kind).maybeSingle();
  const extension = file.type.split("/")[1] || "jpg";
  const storagePath = `${user.id}/${kind}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from("academic_schedule_screenshots").upsert({ user_id: user.id, kind, storage_path: storagePath, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind" });
  if (error) { await supabase.storage.from(BUCKET).remove([storagePath]); throw error; }
  if (existing?.storage_path) await supabase.storage.from(BUCKET).remove([existing.storage_path]);
  revalidatePath("/academics");
}

export async function deleteAcademicScheduleScreenshot(kind: AcademicScreenshotKind) {
  const { supabase, user } = await userClient();
  const { data } = await supabase.from("academic_schedule_screenshots").select("storage_path").eq("user_id", user.id).eq("kind", kind).maybeSingle();
  if (data?.storage_path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([data.storage_path]);
    if (storageError) throw storageError;
  }
  const { error } = await supabase.from("academic_schedule_screenshots").delete().eq("user_id", user.id).eq("kind", kind);
  if (error) throw error;
  revalidatePath("/academics");
}
