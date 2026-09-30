import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface LockedFeatureProps {
  /** Short name of what's locked, e.g. "Arabic captions" or "PDF export". */
  label: string;
  /** Where the upgrade CTA should point. Defaults to /billing (existing
   * subscribers) — pass "/choose-plan" for pre-subscription contexts. */
  href?: "/billing" | "/choose-plan";
  className?: string;
  /** Renders as a compact inline badge instead of a full block. */
  inline?: boolean;
}

/** Standard "feature exists but isn't on your plan" treatment — shows the
 * control locked with a 🔒 and an upgrade link, rather than hiding it, so
 * every tier can see what upgrading buys them. */
export function LockedFeature({
  label,
  href = "/billing",
  className,
  inline = false,
}: LockedFeatureProps) {
  if (inline) {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary",
          className
        )}
      >
        <Lock className="h-3 w-3" />
        {label}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </div>
      <Link
        href={href}
        className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Upgrade to unlock
      </Link>
    </div>
  );
}
