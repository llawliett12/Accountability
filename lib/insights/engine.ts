// Pure pattern-discovery logic. Reuses the existing pearsonCorrelation from
// lib/analytics/engine.ts rather than duplicating it — this file only adds
// the minimum-sample-size gate, strength/direction classification, and
// causation-safe phrasing on top.

import { pearsonCorrelation, average } from "../analytics/engine";

// Explicit, configurable minimum sample size. Below this, a pattern is
// never surfaced as a finding — only "not enough data yet".
export const DEFAULT_MIN_SAMPLE_SIZE = 7;

export type PatternStrength = "none" | "weak" | "moderate" | "strong";
export type PatternDirection = "positive" | "negative" | "none";

export interface Pattern {
  labelA: string;
  labelB: string;
  sampleSize: number;
  r: number | null;
  direction: PatternDirection;
  strength: PatternStrength;
  insufficientData: boolean;
  interpretation: string;
}

function classifyStrength(r: number): PatternStrength {
  const abs = Math.abs(r);
  if (abs < 0.2) return "weak";
  if (abs < 0.5) return "moderate";
  return "strong";
}

// Extracts only the (x, y) pairs where both values are present — a day
// missing sleep data simply isn't included in a sleep-vs-X pattern, rather
// than being treated as zero.
export function extractPairs<T>(
  rows: T[],
  getA: (row: T) => number | null,
  getB: (row: T) => number | null
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const row of rows) {
    const a = getA(row);
    const b = getB(row);
    if (a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b)) {
      xs.push(a);
      ys.push(b);
    }
  }
  return { xs, ys };
}

export function buildPattern(
  labelA: string,
  labelB: string,
  xs: number[],
  ys: number[],
  minSampleSize: number = DEFAULT_MIN_SAMPLE_SIZE
): Pattern {
  const sampleSize = Math.min(xs.length, ys.length);

  if (sampleSize < minSampleSize) {
    return {
      labelA,
      labelB,
      sampleSize,
      r: null,
      direction: "none",
      strength: "none",
      insufficientData: true,
      interpretation: "Not enough data yet.",
    };
  }

  const r = pearsonCorrelation(xs, ys);

  if (r === null) {
    return {
      labelA,
      labelB,
      sampleSize,
      r: null,
      direction: "none",
      strength: "none",
      insufficientData: true,
      interpretation: "Not enough variation in the data yet to find a pattern.",
    };
  }

  const strength = classifyStrength(r);
  const direction: PatternDirection = r > 0 ? "positive" : r < 0 ? "negative" : "none";

  let interpretation: string;
  if (strength === "weak") {
    interpretation = `Only a weak relationship was found between ${labelA} and ${labelB} — not a reliable pattern yet.`;
  } else {
    const qualifier = strength === "strong" ? "notably" : "somewhat";
    const relation = direction === "positive" ? "also tended to be higher" : "tended to be lower";
    interpretation = `On days when ${labelA} was higher, ${labelB} ${relation} (${qualifier} correlated). This is a correlation, not proof that one causes the other.`;
  }

  return { labelA, labelB, sampleSize, r, direction, strength, insufficientData: false, interpretation };
}

// Two-group comparison (e.g. morning vs evening) — not a correlation, since
// there's no shared numeric x-axis, just two buckets. Kept in this module
// since it's used alongside correlation patterns in the same UI.
export interface GroupComparison {
  labelA: string;
  labelB: string;
  totalA: number;
  totalB: number;
  sampleSizeA: number;
  sampleSizeB: number;
  insufficientData: boolean;
  interpretation: string;
}

export function buildGroupComparison(
  labelA: string,
  labelB: string,
  valuesA: number[],
  valuesB: number[],
  minSampleSize: number = DEFAULT_MIN_SAMPLE_SIZE
): GroupComparison {
  const sampleSizeA = valuesA.length;
  const sampleSizeB = valuesB.length;

  if (sampleSizeA < minSampleSize || sampleSizeB < minSampleSize) {
    return {
      labelA,
      labelB,
      totalA: average(valuesA),
      totalB: average(valuesB),
      sampleSizeA,
      sampleSizeB,
      insufficientData: true,
      interpretation: "Not enough data yet.",
    };
  }

  const avgA = average(valuesA);
  const avgB = average(valuesB);
  const higher = avgA > avgB ? labelA : avgB > avgA ? labelB : null;

  return {
    labelA,
    labelB,
    totalA: Math.round(avgA * 10) / 10,
    totalB: Math.round(avgB * 10) / 10,
    sampleSizeA,
    sampleSizeB,
    insufficientData: false,
    interpretation: higher
      ? `${higher} sessions averaged more focus time over this period.`
      : `${labelA} and ${labelB} averaged about the same amount of focus time.`,
  };
}
