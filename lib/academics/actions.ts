"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { occurrenceDatesInRange } from "./engine";
import type { AttendanceStatus, AssessmentType, AssessmentStatus, DeadlineStatus } from "./types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------- classes ----------

export async function createClass(input: {
  name: string;
  subject?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location?: string;
  instructor?: string;
  attendance_target?: number;
}) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("classes")
    .insert({
      user_id: user.id,
      name: input.name,
      subject: input.subject ?? null,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      location: input.location ?? null,
      instructor: input.instructor ?? null,
      attendance_target: input.attendance_target ?? 75,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Generate the next 8 weeks of occurrences immediately so the class shows
  // up on the calendar without a separate manual step.
  await generateOccurrences(data.id, todayISO(), addDays(todayISO(), 56));

  revalidatePath("/academics");
  revalidatePath("/academics/classes");
  return data.id as string;
}

export async function deactivateClass(classId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("classes")
    .update({ active: false })
    .eq("id", classId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/academics/classes");
}

// ---------- occurrences ----------

// Idempotent: relies on the (class_id, date) unique constraint, so calling
// this repeatedly for overlapping ranges never creates duplicate meetings.
export async function generateOccurrences(classId: string, startISO: string, endISO: string) {
  const { supabase, user } = await requireUser();

  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("id, day_of_week, start_time, end_time")
    .eq("id", classId)
    .eq("user_id", user.id)
    .single();
  if (clsErr) throw clsErr;

  const dates = occurrenceDatesInRange(cls.day_of_week, startISO, endISO);
  if (dates.length === 0) return;

  const rows = dates.map((date) => ({
    user_id: user.id,
    class_id: classId,
    date,
    start_time: cls.start_time,
    end_time: cls.end_time,
  }));

  const { error } = await supabase
    .from("class_occurrences")
    .upsert(rows, { onConflict: "class_id,date", ignoreDuplicates: true });
  if (error) throw error;

  revalidatePath("/academics");
  revalidatePath("/academics/calendar");
  revalidatePath(`/academics/classes/${classId}`);
}

export async function markAttendance(occurrenceId: string, status: AttendanceStatus) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("class_occurrences")
    .update({ attendance_status: status, status: "held" })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .select("class_id")
    .single();
  if (error) throw error;

  revalidatePath("/academics");
  revalidatePath("/academics/calendar");
  revalidatePath(`/academics/classes/${data.class_id}`);
}

export async function markListening(occurrenceId: string, rating: number) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("class_occurrences")
    .update({ listening_rating: rating })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .select("class_id")
    .single();
  if (error) throw error;
  revalidatePath(`/academics/classes/${data.class_id}`);
}

export async function markPrepared(occurrenceId: string, prepared: boolean) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("class_occurrences")
    .update({ prepared })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .select("class_id")
    .single();
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath(`/academics/classes/${data.class_id}`);
}

export async function markReviewed(occurrenceId: string, reviewed: boolean) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("class_occurrences")
    .update({ reviewed })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .select("class_id")
    .single();
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath(`/academics/classes/${data.class_id}`);
}

export async function cancelOccurrence(occurrenceId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("class_occurrences")
    .update({ status: "cancelled" })
    .eq("id", occurrenceId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/academics/calendar");
}

// ---------- assessments (quizzes/exams) ----------

export async function createAssessment(input: {
  title: string;
  type: AssessmentType;
  date: string;
  class_id?: string;
  notes?: string;
  target_score?: number;
  prep_hours?: number;
}) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("assessments")
    .insert({
      user_id: user.id,
      title: input.title,
      type: input.type,
      date: input.date,
      class_id: input.class_id ?? null,
      notes: input.notes ?? null,
      target_score: input.target_score ?? null,
      prep_hours: input.prep_hours ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/academics/calendar");
  return data.id as string;
}

export async function addPracticeScore(assessmentId: string, score: number) {
  const { supabase, user } = await requireUser();
  const { data: existing, error: fetchError } = await supabase
    .from("assessments")
    .select("practice_scores")
    .eq("id", assessmentId)
    .eq("user_id", user.id)
    .single();
  if (fetchError) throw fetchError;
  const scores = [...((existing?.practice_scores as number[]) ?? []), score];
  const { error } = await supabase
    .from("assessments")
    .update({ practice_scores: scores })
    .eq("id", assessmentId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath(`/academics/assessments/${assessmentId}`);
}

export async function recordAssessmentScore(
  assessmentId: string,
  score: number,
  maxScore: number
) {
  const { supabase, user } = await requireUser();
  const status: AssessmentStatus = "completed";
  const { error } = await supabase
    .from("assessments")
    .update({ score, max_score: maxScore, status })
    .eq("id", assessmentId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath(`/academics/assessments/${assessmentId}`);
}

// ---------- deadlines ----------

export async function createDeadline(input: {
  title: string;
  due_date: string;
  class_id?: string;
  category?: string;
  notes?: string;
}) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("deadlines")
    .insert({
      user_id: user.id,
      title: input.title,
      due_date: input.due_date,
      class_id: input.class_id ?? null,
      category: input.category ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/academics/calendar");
  return data.id as string;
}

export async function updateDeadlineStatus(deadlineId: string, status: DeadlineStatus) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("deadlines")
    .update({ status })
    .eq("id", deadlineId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/academics/calendar");
}
