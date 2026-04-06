"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products": "Products",
  "/outfits": "Outfits",
  "/export": "Export",
};

export function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "ModaMind";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-sm">
      {/* Page title */}
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>

      {/* Right section */}
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="w-64 pl-9"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </Button>

        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs font-medium">MM</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
