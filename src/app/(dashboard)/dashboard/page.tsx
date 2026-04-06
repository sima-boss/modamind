import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Welcome to ModaMind
        </h2>
        <p className="text-muted-foreground">
          Your AI-powered fashion intelligence hub.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Products", value: "0", change: "—" },
          { label: "Outfits Created", value: "0", change: "—" },
          { label: "Exports", value: "0", change: "—" },
          { label: "AI Suggestions", value: "0", change: "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-card p-5 shadow-sm"
          >
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{stat.value}</span>
              <Badge variant="secondary" className="text-xs">
                {stat.change}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder sections */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
          Recent Activity
        </div>
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
          Quick Actions
        </div>
      </div>
    </div>
  );
}
