"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Loader2, RefreshCw, ShoppingBag, Wrench } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PlanCard } from "@/components/billing/PlanCard";
import { TopUpModal } from "@/components/billing/TopUpModal";
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dialogPlan, setDialogPlan] = useState<Plan | null>(null);
  const [showTopUpModal, setShowTopUpModal] = useState(false);

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

  async function runAction(fn: () => Promise<void>, successMsg?: string) {
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await fn();
      await fetchData();
      setDialogPlan(null);
      window.dispatchEvent(new Event(SUBSCRIPTION_CHANGED_EVENT));
      if (successMsg) {
        setSuccessMessage(successMsg);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
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

  const totalCreditsPurchased = transactions
    .filter((t) => t.type === "top-up" && t.credits != null)
    .reduce((sum, t) => sum + (t.credits ?? 0), 0);

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
      {successMessage && (
        <p className="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          {successMessage}
        </p>
      )}

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
              <div className="mt-3 space-y-2">
                <p className="text-sm">
                  Your plan will change to{" "}
                  <strong>{subscription.pendingPlan.name}</strong> on{" "}
                  {formatDate(subscription.current_period_end)}.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionLoading}
                  onClick={() =>
                    runAction(
                      () => postBilling("cancel-downgrade"),
                      "Scheduled change canceled"
                    )
                  }
                >
                  Cancel scheduled change
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
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
      </div>

      {/* Extra credits wallet */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Coins className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Extra credits</p>
            <p className="text-xl font-semibold">
              {subscription.extra_credits_balance.toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                available · {totalCreditsPurchased.toLocaleString()} total bought
              </span>
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTopUpModal(true)}
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          Buy more credits
        </Button>
      </div>

      {/* Plan comparison */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Compare plans</h3>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === subscription.plan.id;
            const isPendingTarget = plan.id === subscription.pendingPlan?.id;
            const pricier = plan.price_aed > subscription.plan.price_aed;

            let action: React.ReactNode;
            if (isCurrent) {
              action = (
                <Badge variant="secondary" className="w-full justify-center py-1.5">
                  Current plan
                </Badge>
              );
            } else if (isPendingTarget) {
              action = (
                <Badge className="w-full justify-center py-1.5">Scheduled</Badge>
              );
            } else {
              const button = (
                <Button
                  variant={pricier ? "default" : "outline"}
                  className="w-full"
                  disabled={hasPending}
                  onClick={() => setDialogPlan(plan)}
                >
                  {pricier ? "Upgrade" : "Downgrade"}
                </Button>
              );
              action = hasPending ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="block w-full">
                      {button}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Cancel the scheduled change first</TooltipContent>
                </Tooltip>
              ) : (
                button
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
                {t.type === "top-up" && t.credits != null && (
                  <Badge variant="secondary">+{t.credits} credits</Badge>
                )}
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

      {/* Demo tools */}
      <div className="rounded-xl border border-dashed bg-muted/30 p-5">
        <div className="mb-1 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground">
            Demo tools
          </h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          For testing this project only — not part of the real product.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={actionLoading}
          onClick={() =>
            runAction(() => postBilling("debug-set-usage-near-limit"))
          }
        >
          Set my usage near the limit
        </Button>
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
                runAction(
                  () =>
                    postBilling(isUpgrade ? "upgrade" : "downgrade", {
                      plan_id: dialogPlan.id,
                    }),
                  isUpgrade ? undefined : "Downgrade scheduled"
                )
              }
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm {isUpgrade ? "upgrade" : "downgrade"} (Demo)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TopUpModal
        open={showTopUpModal}
        onOpenChange={setShowTopUpModal}
        onPurchased={fetchData}
      />
    </div>
  );
}
