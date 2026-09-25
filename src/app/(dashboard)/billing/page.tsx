"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlanCard } from "@/components/billing/PlanCard";
import { formatAED, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  getBillingTransactions,
  getCurrentSubscription,
  getPlans,
} from "@/lib/supabase/queries";
import type {
  BillingTransaction,
  Plan,
  SubscriptionWithPlan,
} from "@/lib/supabase/types";
import { SUBSCRIPTION_CHANGED_EVENT } from "@/lib/events";

async function postBilling(path: string, body?: Record<string, unknown>) {
  const res = await fetch(`/api/billing/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  }
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogPlan, setDialogPlan] = useState<Plan | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [sub, allPlans, txns] = await Promise.all([
      getCurrentSubscription(supabase),
      getPlans(supabase),
      getBillingTransactions(supabase),
    ]);
    setSubscription(sub);
    setPlans(allPlans);
    setTransactions(txns);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function runAction(fn: () => Promise<void>) {
    setActionLoading(true);
    setError(null);
    try {
      await fn();
      await fetchData();
      setDialogPlan(null);
      window.dispatchEvent(new Event(SUBSCRIPTION_CHANGED_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No active subscription found.
      </div>
    );
  }

  const hasPending = !!subscription.pendingPlan;
  const isUpgrade = dialogPlan
    ? dialogPlan.price_aed > subscription.plan.price_aed
    : false;
  const priceDiff = dialogPlan ? dialogPlan.price_aed - subscription.plan.price_aed : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">
          Manage your subscription and view your billing history.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Current plan */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <h3 className="text-xl font-semibold">{subscription.plan.name}</h3>
            <p className="text-sm text-muted-foreground">
              {formatAED(subscription.plan.price_aed)}/month · Renews on{" "}
              {formatDate(subscription.current_period_end)}
            </p>
            {hasPending && subscription.pendingPlan && (
              <p className="mt-2 text-sm">
                Your plan will change to{" "}
                <strong>{subscription.pendingPlan.name}</strong> on{" "}
                {formatDate(subscription.current_period_end)}.{" "}
                <button
                  className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
                  disabled={actionLoading}
                  onClick={() => runAction(() => postBilling("cancel-downgrade"))}
                >
                  Cancel scheduled change
                </button>
              </p>
            )}
          </div>

          <div className="space-y-1 text-right">
            <Button
              variant="outline"
              size="sm"
              disabled={actionLoading}
              onClick={() => runAction(() => postBilling("simulate-renewal"))}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Simulate renewal (Demo)
            </Button>
            <p className="max-w-[220px] text-xs text-muted-foreground">
              Demo only — normally happens automatically when the billing
              period ends.
            </p>
          </div>
        </div>
      </div>

      {/* Plan comparison */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Compare plans</h3>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === subscription.plan.id;
            const pricier = plan.price_aed > subscription.plan.price_aed;

            let action: React.ReactNode;
            if (isCurrent) {
              action = (
                <Badge variant="secondary" className="w-full justify-center py-1.5">
                  Current plan
                </Badge>
              );
            } else {
              action = (
                <Button
                  variant={pricier ? "default" : "outline"}
                  className="w-full"
                  disabled={hasPending}
                  onClick={() => setDialogPlan(plan)}
                >
                  {pricier ? "Upgrade" : "Downgrade"}
                </Button>
              );
            }

            return <PlanCard key={plan.id} plan={plan} action={action} />;
          })}
        </div>
      </div>

      {/* Billing history */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Demo transactions</h3>
        </div>
        {transactions.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No transactions yet.
          </div>
        ) : (
          <div className="divide-y">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(t.created_at)}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {t.type}
                </Badge>
                <span className="w-24 shrink-0 text-right text-sm font-medium">
                  {formatAED(t.amount_aed)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!dialogPlan} onOpenChange={(open) => !open && setDialogPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isUpgrade ? "Confirm upgrade" : "Confirm downgrade"}
            </DialogTitle>
            <DialogDescription>
              {dialogPlan && isUpgrade && (
                <>You will pay {formatAED(priceDiff)} now.</>
              )}
              {dialogPlan && !isUpgrade && (
                <>
                  Your plan will change to <strong>{dialogPlan.name}</strong>{" "}
                  on {formatDate(subscription.current_period_end)}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogPlan(null)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              disabled={actionLoading}
              onClick={() =>
                dialogPlan &&
                runAction(() =>
                  postBilling(isUpgrade ? "upgrade" : "downgrade", {
                    plan_id: dialogPlan.id,
                  })
                )
              }
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm {isUpgrade ? "upgrade" : "downgrade"} (Demo)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
