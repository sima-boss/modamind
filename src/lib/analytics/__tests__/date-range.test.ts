import { describe, it, expect } from "vitest";
import {
  addDays,
  bucketSize,
  bucketWeekly,
  formatRange,
  isIsoDate,
  pctChange,
  presetRange,
  previousPeriod,
  rangeLength,
  resolveRange,
  todayInDubai,
  validateRange,
} from "../date-range";

const TODAY = "2026-11-21";

describe("todayInDubai", () => {
  it("uses the Dubai calendar day (UTC+4)", () => {
    expect(todayInDubai(new Date("2026-11-21T19:59:00Z"))).toBe("2026-11-21");
    expect(todayInDubai(new Date("2026-11-21T21:30:00Z"))).toBe("2026-11-22");
  });
});

describe("date maths", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("counts days inclusively", () => {
    expect(rangeLength("2026-11-21", "2026-11-21")).toBe(1);
    expect(rangeLength("2026-05-30", "2026-07-30")).toBe(62);
  });

  it("rejects malformed and impossible dates", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("21/11/2026")).toBe(false);
    expect(isIsoDate("2026-11-21")).toBe(true);
  });
});

describe("presetRange", () => {
  it("ends today and covers exactly N days", () => {
    for (const [preset, days] of [["7d", 7], ["30d", 30], ["90d", 90]] as const) {
      const r = presetRange(preset, TODAY);
      expect(r.to).toBe(TODAY);
      expect(rangeLength(r.from, r.to)).toBe(days);
    }
  });

  it("this month starts on the 1st", () => {
    expect(presetRange("month", TODAY)).toEqual({ from: "2026-11-01", to: TODAY });
    expect(presetRange("month", "2026-01-01")).toEqual({
      from: "2026-01-01",
      to: "2026-01-01",
    });
  });
});

describe("validateRange", () => {
  it("accepts a valid range", () => {
    expect(validateRange("2026-05-30", "2026-07-30", TODAY)).toBeNull();
  });

  it("rejects From after To", () => {
    expect(validateRange("2026-07-30", "2026-05-30", TODAY)).toMatch(/before/);
  });

  it("rejects a future To", () => {
    expect(validateRange("2026-11-01", "2026-11-22", TODAY)).toMatch(/future/);
  });

  it("allows 366 days but not 367", () => {
    expect(validateRange(addDays(TODAY, -365), TODAY, TODAY)).toBeNull();
    expect(validateRange(addDays(TODAY, -366), TODAY, TODAY)).toMatch(/366/);
  });

  it("rejects missing or garbage input", () => {
    expect(validateRange(undefined, TODAY, TODAY)).not.toBeNull();
    expect(validateRange("nope", TODAY, TODAY)).not.toBeNull();
  });
});

describe("resolveRange", () => {
  it("defaults to the last 30 days", () => {
    expect(resolveRange({}, TODAY, { full: true })).toEqual({
      ok: true,
      preset: "30d",
      from: "2026-10-23",
      to: TODAY,
      days: 30,
    });
  });

  it("forces 30 days for plans without full analytics", () => {
    const r = resolveRange(
      { range: "custom", from: "2026-01-01", to: "2026-03-01" },
      TODAY,
      { full: false }
    );
    expect(r).toMatchObject({ ok: true, preset: "30d", days: 30 });
    expect(resolveRange({ range: "90d" }, TODAY, { full: false })).toMatchObject({
      preset: "30d",
    });
  });

  it("accepts a valid custom range", () => {
    expect(
      resolveRange({ range: "custom", from: "2026-05-30", to: "2026-07-30" }, TODAY, {
        full: true,
      })
    ).toMatchObject({ ok: true, from: "2026-05-30", to: "2026-07-30", days: 62 });
  });

  it("returns an error for an invalid custom range", () => {
    const r = resolveRange({ range: "custom", from: "2026-08-01", to: "2026-07-01" }, TODAY, {
      full: true,
    });
    expect(r.ok).toBe(false);
  });

  it("falls back to the default for unknown presets", () => {
    expect(resolveRange({ range: "999d" }, TODAY, { full: true })).toMatchObject({
      preset: "30d",
    });
  });
});

describe("previousPeriod", () => {
  it("has the same length and ends the day before", () => {
    const prev = previousPeriod("2026-10-08", "2026-10-21");
    expect(prev).toEqual({ from: "2026-09-24", to: "2026-10-07" });
    expect(rangeLength(prev.from, prev.to)).toBe(14);
  });

  it("crosses year boundaries", () => {
    expect(previousPeriod("2026-01-01", "2026-01-31")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});

describe("bucketing", () => {
  it("uses daily points up to 90 days and weekly beyond", () => {
    expect(bucketSize(90)).toBe("day");
    expect(bucketSize(91)).toBe("week");
  });

  it("groups into weeks, keeps totals and ends on the last day", () => {
    const from = "2026-01-01";
    const daily = Array.from({ length: 100 }, (_, i) => ({
      day: addDays(from, i),
      outfits: 1,
      captions: 2,
    }));
    const weeks = bucketWeekly(daily);
    expect(weeks).toHaveLength(15);
    expect(weeks[0]).toEqual({ day: from, end: "2026-01-07", outfits: 7, captions: 14 });
    const last = weeks[weeks.length - 1];
    expect(last.end).toBe(daily[99].day);
    expect(last.outfits).toBe(2); // partial last bucket
    expect(weeks.reduce((s, w) => s + w.outfits, 0)).toBe(100);
  });
});

describe("formatRange", () => {
  it("shows the year once when both dates share it", () => {
    expect(formatRange("2026-10-01", "2026-10-30")).toBe("1 Oct – 30 Oct 2026");
  });

  it("shows both years across a year boundary", () => {
    expect(formatRange("2025-12-28", "2026-01-05")).toBe("28 Dec 2025 – 5 Jan 2026");
  });
});

describe("pctChange", () => {
  it("returns null without a baseline", () => {
    expect(pctChange(5, 0)).toBeNull();
  });

  it("rounds the change", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(2, 3)).toBe(-33);
  });
});
