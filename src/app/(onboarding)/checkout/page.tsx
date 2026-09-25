"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAED } from "@/lib/format";
import { getPlanFeatures } from "@/lib/plans";
import { createClient } from "@/lib/supabase/client";
import { getPlans } from "@/lib/supabase/queries";
import type { Plan } from "@/lib/supabase/types";

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CheckoutForm />
    </Suspense>
  );
}

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan");

  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlans(createClient()).then((plans) => {
      setPlan(plans.find((p) => p.id === planId) ?? null);
    });
  }, [planId]);

  async function confirm() {
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (plan === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (plan === null) {
    return (
      <div className="mx-auto max-w-sm space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Plan not found
        </h1>
        <p className="text-sm text-muted-foreground">
          That plan doesn&apos;t exist. Pick one from the list instead.
        </p>
        <Link
          href="/choose-plan"
          className="inline-block text-sm font-medium underline-offset-4 hover:underline"
        >
          Back to plans
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Confirm your subscription
        </h1>
        <p className="mt-1 text-muted-foreground">
          Review your plan before continuing.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">{plan.name}</h2>
          <p>
            <span className="text-2xl font-bold tracking-tight">
              {formatAED(plan.price_aed)}
            </span>
            <span className="text-sm text-muted-foreground">/month</span>
          </p>
        </div>

        <ul className="mt-4 space-y-2">
          {getPlanFeatures(plan).map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>DEMO MODE</strong> — no real payment will be taken.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button className="w-full" disabled={submitting} onClick={confirm}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitting ? "Confirming..." : "Confirm subscription (Demo)"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/choose-plan"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Choose a different plan
        </Link>
      </p>
    </div>
  );
}
