"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAED } from "@/lib/format";
import { TOPUP_PACKAGES, type TopUpPackage } from "@/lib/topups";
import { SUBSCRIPTION_CHANGED_EVENT } from "@/lib/events";

interface TopUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchased?: () => void;
}

export function TopUpModal({ open, onOpenChange, onPurchased }: TopUpModalProps) {
  const [pending, setPending] = useState<TopUpPackage["id"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(pkg: TopUpPackage) {
    setPending(pkg.id);
    setError(null);
    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: pkg.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong.");
      }
      window.dispatchEvent(new Event(SUBSCRIPTION_CHANGED_EVENT));
      onPurchased?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buy extra credits</DialogTitle>
          <DialogDescription>
            Extra credits are usable for outfit generations or AI captions
            (1 credit each), never expire, and are used after your monthly
            allowance runs out. DEMO MODE — no real payment will be taken.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {TOPUP_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div>
                <p className="font-medium">{pkg.credits} credits</p>
                <p className="text-sm text-muted-foreground">
                  {formatAED(pkg.amount_aed)}
                </p>
              </div>
              <Button
                size="sm"
                disabled={pending !== null}
                onClick={() => buy(pkg)}
              >
                {pending === pkg.id && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirm (Demo)
              </Button>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
