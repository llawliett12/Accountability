// Server-only Gemini Vision integration. This file must never be imported
// from a Client Component — it reads GEMINI_API_KEY (deliberately NOT
// NEXT_PUBLIC_*) and calls the Gemini REST API directly. The only caller is
// lib/screen-time/actions.ts, which is itself a "use server" module.
//
// This is intentionally the ONLY place in the app that talks to Gemini.
// Discipline scoring, attendance, goal progress, and all deterministic
// analytics never import anything from this file or know it exists.

import { validateGeminiExtraction, type ParsedExtraction } from "./engine";
import type { RawGeminiExtraction } from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash";

export type GeminiErrorType =
  | "not_configured"
  | "rate_limited"
  | "network_error"
  | "invalid_response"
  | "unreadable_image";

export interface GeminiFailure {
  success: false;
  errorType: GeminiErrorType;
  message: string;
}

export interface GeminiSuccess {
  success: true;
  extraction: ParsedExtraction;
  rawResponseText: string;
}

const EXTRACTION_PROMPT = `You are looking at a screenshot of an Android phone's screen-time/digital-wellbeing page.

Extract ONLY what is visibly present. Do not guess or invent values.

Respond with ONLY a single JSON object (no markdown fences, no prose) in exactly this shape:
{
  "date": "YYYY-MM-DD or null if not visible",
  "total_minutes": <integer minutes of total screen time, or null if not visible>,
  "apps": [
    { "app_name": "string", "duration_minutes": <integer>, "category": "string or null" }
  ]
}

If this does not look like a screen-time/digital-wellbeing screenshot at all, still return
the same JSON shape with "apps": [] and "total_minutes": null.`;

// Strips code fences etc. Gemini sometimes wraps JSON in ```json even when
// asked not to.
function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

export async function analyzeScreenshotWithGemini(
  imageBase64: string,
  mimeType: string
): Promise<GeminiSuccess | GeminiFailure> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      errorType: "not_configured",
      message: "Gemini isn't configured on this server. Use manual entry instead.",
    };
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    });
  } catch {
    // Never log the underlying error — it could echo request details.
    return {
      success: false,
      errorType: "network_error",
      message: "Couldn't reach Gemini. Use manual entry instead.",
    };
  }

  if (response.status === 429) {
    return {
      success: false,
      errorType: "rate_limited",
      message: "Gemini is rate-limited right now. Use manual entry instead.",
    };
  }

  if (!response.ok) {
    return {
      success: false,
      errorType: "network_error",
      message: `Gemini returned an error (status ${response.status}). Use manual entry instead.`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      success: false,
      errorType: "invalid_response",
      message: "Gemini's response wasn't valid JSON. Use manual entry instead.",
    };
  }

  const text = extractTextFromGeminiBody(body);
  if (!text) {
    return {
      success: false,
      errorType: "unreadable_image",
      message: "Gemini couldn't read that screenshot. Use manual entry instead.",
    };
  }

  let parsedRaw: RawGeminiExtraction;
  try {
    parsedRaw = JSON.parse(extractJsonText(text));
  } catch {
    return {
      success: false,
      errorType: "invalid_response",
      message: "Gemini's response wasn't in the expected format. Use manual entry instead.",
    };
  }

  // Never trust the parsed JSON blindly — run it through the same
  // deterministic validation manual entries go through.
  const extraction = validateGeminiExtraction(parsedRaw);
  return { success: true, extraction, rawResponseText: text };
}

function extractTextFromGeminiBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const candidates = (body as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const content = (candidates[0] as Record<string, unknown> | undefined)?.content;
  const parts = (content as Record<string, unknown> | undefined)?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const text = (parts[0] as Record<string, unknown> | undefined)?.text;
  return typeof text === "string" ? text : null;
}
