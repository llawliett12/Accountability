export type ScreenTimeSource = "gemini" | "manual";
export type ExtractionStatus = "pending" | "confirmed" | "failed" | "manual";

export interface AppUsage {
  app_name: string;
  duration_minutes: number;
  category: string | null;
}

export interface ScreenTimeRecord {
  id: string;
  user_id: string;
  date: string;
  total_minutes: number;
  source: ScreenTimeSource;
  extraction_status: ExtractionStatus;
  screenshot_path: string | null;
  raw_extraction: unknown;
  created_at: string;
  updated_at: string;
}

export interface ScreenTimeRecordWithApps extends ScreenTimeRecord {
  apps: AppUsage[];
}

// What we ask Gemini for, and what we validate its response against.
export interface RawGeminiExtraction {
  date?: unknown;
  total_minutes?: unknown;
  apps?: unknown;
}
