// Pure date-range helpers for /analytics. Dates are ISO "YYYY-MM-DD"
// strings; maths runs on UTC Dates so local timezone / DST never leaks in.
// "Today" is the Asia/Dubai calendar day, matching the SQL bucketing.

export const RANGE_PRESETS = ["7d", "30d", "90d", "month", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const DEFAULT_PRESET: RangePreset = "30d";
export const MAX_RANGE_DAYS = 366;
/** Ranges longer than this are charted per week instead of per day. */
export const MAX_DAILY_POINTS = 90;

const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO_RE.test(s)) return false;
  const d = toDate(s);
  return !Number.isNaN(d.getTime()) && toIso(d) === s;
}

export function todayInDubai(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, n: number): string {
  return toIso(new Date(toDate(iso).getTime() + n * DAY_MS));
}

/** Inclusive number of days from `from` to `to`. */
export function rangeLength(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS) + 1;
}

export function presetRange(
  preset: Exclude<RangePreset, "custom">,
  today: string
): { from: string; to: string } {
  switch (preset) {
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "month":
      return { from: `${today.slice(0, 8)}01`, to: today };
  }
}

/** Returns an error message, or null when the range is valid. */
export function validateRange(
  from: string | undefined,
  to: string | undefined,
  today: string
): string | null {
  if (!isIsoDate(from) || !isIsoDate(to)) return "Pick both a From and a To date.";
  if (from > to) return "From must be on or before To.";
  if (to > today) return "To can't be in the future.";
  if (rangeLength(from, to) > MAX_RANGE_DAYS)
    return `Pick a range of ${MAX_RANGE_DAYS} days or less.`;
  return null;
}

export type ResolvedRange =
  | { ok: true; preset: RangePreset; from: string; to: string; days: number }
  | { ok: false; preset: RangePreset; from?: string; to?: string; error: string };

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Turns URL search params into a range. Plans without full analytics
 * always get the last 30 days, whatever the URL asks for. */
export function resolveRange(
  params: Params,
  today: string,
  { full }: { full: boolean }
): ResolvedRange {
  const raw = first(params.range);
  const preset: RangePreset =
    full && RANGE_PRESETS.includes(raw as RangePreset)
      ? (raw as RangePreset)
      : DEFAULT_PRESET;

  if (preset !== "custom") {
    const { from, to } = presetRange(preset, today);
    return { ok: true, preset, from, to, days: rangeLength(from, to) };
  }

  const from = first(params.from);
  const to = first(params.to);
  const error = validateRange(from, to, today);
  if (error) return { ok: false, preset, from, to, error };
  return { ok: true, preset, from: from!, to: to!, days: rangeLength(from!, to!) };
}

/** The period of equal length immediately before [from, to]. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const days = rangeLength(from, to);
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

export function bucketSize(days: number): "day" | "week" {
  return days <= MAX_DAILY_POINTS ? "day" : "week";
}

export type TrendPoint = { day: string; end: string; outfits: number; captions: number };

/** Groups zero-filled daily points into 7-day buckets starting at the
 * first day. The last bucket may be shorter and ends on the last day. */
export function bucketWeekly(
  points: { day: string; outfits: number; captions: number }[]
): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let i = 0; i < points.length; i += 7) {
    const chunk = points.slice(i, i + 7);
    out.push({
      day: chunk[0].day,
      end: chunk[chunk.length - 1].day,
      outfits: chunk.reduce((s, p) => s + p.outfits, 0),
      captions: chunk.reduce((s, p) => s + p.captions, 0),
    });
  }
  return out;
}

export function formatDay(iso: string, withYear = false): string {
  return toDate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** "1 Oct – 30 Oct 2026", or "28 Dec 2025 – 5 Jan 2026" across years. */
export function formatRange(from: string, to: string, sep = " – "): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatDay(from, !sameYear)}${sep}${formatDay(to, true)}`;
}

/** % change vs a baseline; null when there's no baseline to compare to. */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
