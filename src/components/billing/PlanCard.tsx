import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAED } from "@/lib/format";
import { getPlanFeatures } from "@/lib/plans";
import type { Plan } from "@/lib/supabase/types";

interface PlanCardProps {
  plan: Plan;
  action: React.ReactNode;
}

export function PlanCard({ plan, action }: PlanCardProps) {
  return (
    <div
      data-plan-id={plan.id}
      className={cn(
        "flex flex-col rounded-xl border bg-card p-6 shadow-sm",
        plan.is_most_popular && "border-primary ring-1 ring-primary"
      )}
    >
      {plan.is_most_popular && (
        <Badge className="mb-3 w-fit">Most popular</Badge>
      )}
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className="mt-1">
        <span className="text-3xl font-bold tracking-tight">
          {formatAED(plan.price_aed)}
        </span>
        <span className="text-sm text-muted-foreground">/month</span>
      </p>

      <ul className="mt-6 flex-1 space-y-2.5">
        {getPlanFeatures(plan).map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">{action}</div>
    </div>
  );
}
