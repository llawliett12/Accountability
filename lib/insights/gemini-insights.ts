// Server-only. Never imported by a client component. This file only turns
// already-computed statistics into readable prose — it never computes a
// statistic itself, never determines the discipline score, and never
// writes to the database. If this entire file were deleted, every other
// feature in the app would keep working exactly as before.

const DEFAULT_MODEL = "gemini-2.5-flash";

export interface InsightsSummaryInput {
  period: "week" | "month";
  focus_hours: number;
  task_completion_pct: number;
  screen_time_hours: number | null;
  sleep_hours: number | null;
  discipline_score: number | null;
  top_patterns: string[]; // short pre-written interpretation strings, not raw data
}

export interface NarrativeFailure {
  success: false;
  message: string;
}

export interface NarrativeSuccess {
  success: true;
  bullets: string[];
}

const PROMPT_INSTRUCTIONS = `You are summarizing a personal productivity app's already-calculated
statistics for the user. You are NOT calculating anything — every number below is final and
correct; only phrase it clearly.

Rules:
- Do not invent any number not given below.
- Do not claim causation (never say "X caused Y" or "because of X"). Use phrasing like
  "on days with higher X, Y was also higher."
- Keep it practical and brief: at most 5 short bullet points.
- Cover, where the data supports it: biggest apparent improvement, biggest apparent decline,
  the strongest pattern given, a likely time-waster if screen time is notably high, an academic
  concern if relevant, and one practical suggestion.
- Respond with ONLY a JSON array of strings (each string one bullet), no markdown fences, no prose.

DATA:
`;

export async function generateNarrativeInsights(
  summary: InsightsSummaryInput
): Promise<NarrativeSuccess | NarrativeFailure> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, message: "AI insights aren't configured on this server." };
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT_INSTRUCTIONS + JSON.stringify(summary) }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
      }),
    });
  } catch {
    return { success: false, message: "Couldn't reach Gemini for insights right now." };
  }

  if (response.status === 429) {
    return { success: false, message: "AI insights are rate-limited right now." };
  }
  if (!response.ok) {
    return { success: false, message: `AI insights unavailable (status ${response.status}).` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { success: false, message: "AI insights returned an unreadable response." };
  }

  const text = extractText(body);
  if (!text) {
    return { success: false, message: "AI insights returned no content." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    return { success: false, message: "AI insights weren't in the expected format." };
  }

  if (!Array.isArray(parsed)) {
    return { success: false, message: "AI insights weren't in the expected format." };
  }

  const bullets = parsed.filter((b): b is string => typeof b === "string" && b.trim().length > 0);
  if (bullets.length === 0) {
    return { success: false, message: "AI insights returned nothing usable." };
  }

  return { success: true, bullets: bullets.slice(0, 5) };
}

function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

function extractText(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const candidates = (body as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const content = (candidates[0] as Record<string, unknown> | undefined)?.content;
  const parts = (content as Record<string, unknown> | undefined)?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const text = (parts[0] as Record<string, unknown> | undefined)?.text;
  return typeof text === "string" ? text : null;
}
