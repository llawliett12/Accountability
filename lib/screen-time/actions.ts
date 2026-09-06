"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { analyzeScreenshotWithGemini } from "./gemini";
import { validateManualEntry } from "./engine";
import type { AppUsage } from "./types";

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

export interface AnalyzeResult {
  success: boolean;
  screenshotPath: string | null;
  date: string | null;
  totalMinutes: number;
  apps: AppUsage[];
  warnings: string[];
  errorMessage: string | null;
}

// Uploads the screenshot to private storage, then asks Gemini to extract
// structured data. Never writes to screen_time_records here — that only
// happens after the user explicitly confirms (see saveScreenTimeRecord).
export async function analyzeScreenshot(formData: FormData): Promise<AnalyzeResult> {
  const { supabase, user } = await requireUser();

  const file = formData.get("screenshot");
  if (!(file instanceof File)) {
    return {
      success: false,
      screenshotPath: null,
      date: null,
      totalMinutes: 0,
      apps: [],
      warnings: [],
      errorMessage: "No file was uploaded.",
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = file.type.split("/")[1] || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("screen-time-screenshots")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  // An upload failure isn't fatal to the flow — the user can still fall
  // back to manual entry without a screenshot on file.
  const screenshotPath = uploadError ? null : path;

  const base64 = buffer.toString("base64");
  const result = await analyzeScreenshotWithGemini(base64, file.type || "image/jpeg");

  if (!result.success) {
    return {
      success: false,
      screenshotPath,
      date: null,
      totalMinutes: 0,
      apps: [],
      warnings: [],
      errorMessage: result.message,
    };
  }

  return {
    success: true,
    screenshotPath,
    date: result.extraction.date,
    totalMinutes: result.extraction.totalMinutes,
    apps: result.extraction.apps,
    warnings: result.extraction.warnings,
    errorMessage: null,
  };
}

// The only function that actually writes a permanent screen_time_records
// row. Called after Gemini extraction has been reviewed/edited by the user,
// or directly for manual entry — either way, this is the single point where
// data becomes a saved record, and it re-validates regardless of source.
export async function saveScreenTimeRecord(input: {
  date: string;
  apps: AppUsage[];
  totalMinutes?: number;
  source: "gemini" | "manual";
  screenshotPath?: string | null;
  rawExtraction?: unknown;
}) {
  const { supabase, user } = await requireUser();

  const validated = validateManualEntry(input.apps, input.totalMinutes ?? null);

  const { data: record, error } = await supabase
    .from("screen_time_records")
    .upsert(
      {
        user_id: user.id,
        date: input.date,
        total_minutes: validated.totalMinutes,
        source: input.source,
        extraction_status: input.source === "gemini" ? "confirmed" : "manual",
        screenshot_path: input.screenshotPath ?? null,
        raw_extraction: input.rawExtraction ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    )
    .select("id")
    .single();
  if (error) throw error;

  // Replace the app list for this record rather than appending — a
  // re-confirmed/edited record should reflect exactly what's on screen now.
  const { error: deleteError } = await supabase
    .from("screen_time_apps")
    .delete()
    .eq("screen_time_record_id", record.id);
  if (deleteError) throw deleteError;

  if (validated.apps.length > 0) {
    const { error: insertError } = await supabase.from("screen_time_apps").insert(
      validated.apps.map((a) => ({
        screen_time_record_id: record.id,
        app_name: a.app_name,
        duration_minutes: a.duration_minutes,
        category: a.category,
      }))
    );
    if (insertError) throw insertError;
  }

  revalidatePath("/screen-time");
  revalidatePath("/screen-time/history");
  revalidatePath("/insights");
  revalidatePath("/weekly");
  revalidatePath("/monthly");

  return { id: record.id as string, warnings: validated.warnings };
}

export async function saveManualEntry(input: {
  date?: string;
  totalMinutes: number;
  apps: AppUsage[];
}) {
  return saveScreenTimeRecord({
    date: input.date ?? todayISO(),
    apps: input.apps,
    totalMinutes: input.totalMinutes,
    source: "manual",
  });
}
