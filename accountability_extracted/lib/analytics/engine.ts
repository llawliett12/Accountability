// Pure aggregation/comparison helpers. No Supabase/Next.js imports —
// callers fetch raw rows, then hand plain numbers to these functions.

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

export interface Comparison {
  current: number;
  previous: number;
  delta: number;
  percentChange: number | null; // null when previous is 0 (undefined % change)
  direction: "up" | "down" | "flat";
}

export function compare(current: number, previous: number): Comparison {
  const delta = round2(current - previous);
  const direction = delta > 0.001 ? "up" : delta < -0.001 ? "down" : "flat";
  const percentChange = previous !== 0 ? round2(((current - previous) / previous) * 100) : null;
  return { current: round2(current), previous: round2(previous), delta, percentChange, direction };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Given a list of {date, value} pairs, finds the single best and worst day.
// Used for "strongest/weakest day" in the monthly dashboard — never invents
// a day that isn't in the data, and returns null on an empty list.
export interface DayValue {
  date: string;
  value: number;
}

export function strongestDay(days: DayValue[]): DayValue | null {
  if (days.length === 0) return null;
  return days.reduce((best, d) => (d.value > best.value ? d : best));
}

export function weakestDay(days: DayValue[]): DayValue | null {
  if (days.length === 0) return null;
  return days.reduce((worst, d) => (d.value < worst.value ? d : worst));
}

// Consistency = how tightly clustered daily scores are (lower stdev = more
// consistent). Returned as 0-100 where 100 is perfectly consistent, so it
// reads the same direction as the discipline score.
export function consistencyScore(values: number[]): number {
  if (values.length < 2) return values.length === 1 ? 100 : 0;
  const avg = average(values);
  const variance = average(values.map((v) => (v - avg) ** 2));
  const stdev = Math.sqrt(variance);
  // A stdev of 0 -> 100 (perfectly consistent). A stdev of 50+ -> near 0.
  return Math.max(0, Math.round(100 - stdev * 2));
}

// Correlation as a plain Pearson coefficient — the caller is responsible for
// phrasing this as "on days when X was higher, Y was also higher" and never
// as causation. This function only returns a number; it makes no claims.
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null; // too few points to mean anything
  const xAvg = average(xs);
  const yAvg = average(ys);
  const numerator = sum(xs.map((x, i) => (x - xAvg) * (ys[i] - yAvg)));
  const xDenom = Math.sqrt(sum(xs.map((x) => (x - xAvg) ** 2)));
  const yDenom = Math.sqrt(sum(ys.map((y) => (y - yAvg) ** 2)));
  if (xDenom === 0 || yDenom === 0) return null;
  return round2(numerator / (xDenom * yDenom));
}
