import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Export</h2>
          <p className="text-muted-foreground">
            Export your data and generated content.
          </p>
        </div>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Export All
        </Button>
      </div>

      {/* Export options */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: "Product Catalog",
            description: "Export all products as CSV or JSON.",
          },
          {
            title: "Outfit Lookbook",
            description: "Generate a styled PDF lookbook.",
          },
          {
            title: "AI Reports",
            description: "Export trend analysis and recommendations.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-sm"
          >
            <div>
              <h3 className="font-medium">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
            <Button variant="outline" className="mt-4 w-full" disabled>
              Coming soon
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
