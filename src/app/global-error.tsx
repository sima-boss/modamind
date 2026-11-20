"use client";

import { useEffect } from "react";
import "./globals.css";
import { BrandMark } from "@/components/layout/BrandMark";

/** Replaces the root layout when it crashes, so it renders its own
 * <html>/<body> and avoids anything that depends on the layout. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background font-sans text-foreground antialiased">
        <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
            <BrandMark className="justify-center" />
            <h1 className="mt-6 text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              An unexpected error occurred. Please try again.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Try again
              </button>
              {/* Plain <a>: a full reload is the safest recovery here. */}
              <a
                href="/dashboard"
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Back to dashboard
              </a>
            </div>
            {error.digest && (
              <p className="mt-6 text-xs text-muted-foreground">
                Reference: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
