"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SlotType } from "@/lib/academics/types";
import { todayISO } from "@/lib/date";
import { occurrenceDatesInRange } from "@/lib/academics/engine";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createCourse(input: {
  code: string;
  name: string;
  description?: string;
  instructor?: string;
  location?: string;
  attendance_target?: number;
  syllabus_notes?: string;
  next_assessment_notes?: string;
}) {
  const { supabase, user } = await requireUser();
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) throw new Error("Course code is required");
  if (!name) throw new Error("Course name is required");

  const { data, error } = await supabase
    .from("courses")
    .insert({
      user_id: user.id,
      code,
      name,
      description: input.description?.trim() || null,
      instructor: input.instructor?.trim() || null,
      location: input.location?.trim() || null,
      attendance_target: input.attendance_target ?? 75,
      syllabus_notes: input.syllabus_notes?.trim() || null,
      next_assessment_notes: input.next_assessment_notes?.trim() || null,
      active: true,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/academics");
  revalidatePath("/");
  return data.id as string;
}

export async function updateCourse(
  courseId: string,
  patch: {
    code?: string;
    name?: string;
    description?: string | null;
    instructor?: string | null;
    location?: string | null;
    attendance_target?: number;
    syllabus_notes?: string | null;
    next_assessment_notes?: string | null;
  }
) {
  const { supabase, user } = await requireUser();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.code !== undefined) payload.code = patch.code.trim();
  if (patch.name !== undefined) payload.name = patch.name.trim();
  if (patch.description !== undefined) payload.description = patch.description?.trim() || null;
  if (patch.instructor !== undefined) payload.instructor = patch.instructor?.trim() || null;
  if (patch.location !== undefined) payload.location = patch.location?.trim() || null;
  if (patch.attendance_target !== undefined) payload.attendance_target = patch.attendance_target;
  if (patch.syllabus_notes !== undefined) payload.syllabus_notes = patch.syllabus_notes?.trim() || null;
  if (patch.next_assessment_notes !== undefined)
    payload.next_assessment_notes = patch.next_assessment_notes?.trim() || null;

  const { error } = await supabase
    .from("courses")
    .update(payload)
    .eq("id", courseId)
    .eq("user_id", user.id);

  if (error) throw error;

  revalidatePath("/academics");
  revalidatePath(`/academics/courses/${courseId}`);
  revalidatePath("/");
}

// Courses must NOT have ordinary destructive deletion. Deactivate/archive instead.
export async function deactivateCourse(courseId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("courses")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", courseId)
    .eq("user_id", user.id);

  if (error) throw error;

  revalidatePath("/academics");
  revalidatePath(`/academics/courses/${courseId}`);
  revalidatePath("/");
}

export async function activateCourse(courseId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("courses")
    .update({ active: true, updated_at: new Date().toISOString() })
    .eq("id", courseId)
    .eq("user_id", user.id);

  if (error) throw error;

  revalidatePath("/academics");
  revalidatePath(`/academics/courses/${courseId}`);
  revalidatePath("/");
}

// Add a recurring timetable slot to a course
export async function addTimetableSlot(input: {
  course_id: string;
  day_of_week: number;
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  location?: string;
  slot_type?: SlotType;
}) {
  const { supabase, user } = await requireUser();

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("code, name, attendance_target")
    .eq("id", input.course_id)
    .eq("user_id", user.id)
    .single();

  if (courseErr) throw courseErr;

  const startTime = input.start_time.length === 5 ? `${input.start_time}:00` : input.start_time;
  const endTime = input.end_time.length === 5 ? `${input.end_time}:00` : input.end_time;

  const { data, error } = await supabase
    .from("classes")
    .insert({
      user_id: user.id,
      course_id: input.course_id,
      name: course.code,
      subject: course.name,
      day_of_week: input.day_of_week,
      start_time: startTime,
      end_time: endTime,
      location: input.location?.trim() || null,
      slot_type: input.slot_type ?? "lecture",
      attendance_target: course.attendance_target,
    })
    .select("id")
    .single();

  if (error) throw error;

  // Generate the next 8 weeks of occurrences for this slot
  const dates = occurrenceDatesInRange(input.day_of_week, todayISO(), addDays(todayISO(), 56));
  if (dates.length > 0) {
    const rows = dates.map((date) => ({
      user_id: user.id,
      course_id: input.course_id,
      class_id: data.id,
      date,
      start_time: startTime,
      end_time: endTime,
      is_extra: false,
    }));

    await supabase
      .from("class_occurrences")
      .upsert(rows, { onConflict: "class_id,date", ignoreDuplicates: true });
  }

  revalidatePath("/academics");
  revalidatePath(`/academics/courses/${input.course_id}`);
  revalidatePath("/");
  return data.id as string;
}

// Create an extra class occurrence that does NOT modify recurring timetable
export async function createExtraClass(input: {
  course_id: string;
  date: string; // ISO date
  start_time: string;
  end_time: string;
  notes?: string;
}) {
  const { supabase, user } = await requireUser();

  const startTime = input.start_time.length === 5 ? `${input.start_time}:00` : input.start_time;
  const endTime = input.end_time.length === 5 ? `${input.end_time}:00` : input.end_time;

  const { data, error } = await supabase
    .from("class_occurrences")
    .insert({
      user_id: user.id,
      course_id: input.course_id,
      class_id: null,
      date: input.date,
      start_time: startTime,
      end_time: endTime,
      is_extra: true,
      notes: input.notes?.trim() || null,
      status: "scheduled",
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/academics");
  revalidatePath(`/academics/courses/${input.course_id}`);
  revalidatePath("/");
  return data.id as string;
}

// Cancel a specific occurrence (cancelled occurrence does NOT count as attendance opportunity)
export async function cancelClassOccurrence(occurrenceId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("class_occurrences")
    .update({ status: "cancelled" })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .select("course_id")
    .single();

  if (error) throw error;

  revalidatePath("/academics");
  if (data?.course_id) {
    revalidatePath(`/academics/courses/${data.course_id}`);
  }
  revalidatePath("/");
}
