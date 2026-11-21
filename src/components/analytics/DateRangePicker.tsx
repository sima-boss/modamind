"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LockedFeature } from "@/components/billing/LockedFeature";
import { type RangePreset, validateRange } from "@/lib/analytics/date-range";
import { cn } from "@/lib/utils";

const OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom" },
];

/** One range control for the whole /analytics page. It only updates the
 * URL; the server page reads the range from searchParams and re-queries. */
export function DateRangePicker({
  preset,
  from,
  to,
  today,
  full,
  error,
}: {
  preset: RangePreset;
  from?: string;
  to?: string;
  /** Today in Asia/Dubai, from the server, so both sides agree. */
  today: string;
  full: boolean;
  /** Server-side validation error for the current URL, if any. */
  error?: string;
}) {
  const router = useRouter();
  const [showCustom, setShowCustom] = useState(preset === "custom");
  const [customFrom, setCustomFrom] = useState(from ?? "");
  const [customTo, setCustomTo] = useState(to ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const active = showCustom ? "custom" : preset;
  const shownError = localError ?? error;

  function choose(value: RangePreset) {
    setLocalError(null);
    if (value === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    router.push(`/analytics?range=${value}`);
  }

  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    const message = validateRange(customFrom, customTo, today);
    setLocalError(message);
    if (message) return;
    router.push(`/analytics?range=custom&from=${customFrom}&to=${customTo}`);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-lg border p-0.5 text-sm">
          {OPTIONS.filter((o) => full || o.value === "30d").map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => choose(o.value)}
              aria-pressed={active === o.value}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                active === o.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {!full &&
          OPTIONS.filter((o) => o.value !== "30d").map((o) => (
            <LockedFeature key={o.value} inline label={o.label} />
          ))}
      </div>

      {full && showCustom && (
        <form onSubmit={applyCustom} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            From
            <input
              type="date"
              value={customFrom}
              max={today}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            To
            <input
              type="date"
              value={customTo}
              max={today}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Apply
          </button>
        </form>
      )}

      {shownError && (
        <p role="alert" className="text-sm text-destructive">
          {shownError}
        </p>
      )}
    </div>
  );
}
