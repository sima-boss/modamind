import { cn } from "@/lib/utils";

/** Fashnix logo mark + wordmark (matches the Sidebar brand). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        F
      </div>
      <span className="text-lg font-semibold tracking-tight">Fashnix</span>
    </div>
  );
}
