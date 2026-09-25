"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanCard } from "@/components/billing/PlanCard";
import { createClient } from "@/lib/supabase/client";
import { getPlans } from "@/lib/supabase/queries";
import type { Plan } from "@/lib/supabase/types";

export default function ChoosePlanPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlans(createClient())
      .then(setPlans)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose your plan
        </h1>
        <p className="mt-1 text-muted-foreground">
          Start your Fashnix subscription — no real payment required in this
          demo.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            action={
              <Button asChild className="w-full">
                <Link href={`/checkout?plan=${plan.id}`}>
                  Choose {plan.name}
                </Link>
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
}
