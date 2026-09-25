"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { useLogout } from "@/lib/hooks/use-logout";

function OnboardingHeader() {
  const { logout, loggingOut } = useLogout();

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
          F
        </div>
        <span className="text-lg font-semibold tracking-tight">Fashnix</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={logout}
        disabled={loggingOut}
      >
        <LogOut className="mr-2 h-4 w-4" />
        {loggingOut ? "Logging out..." : "Log out"}
      </Button>
    </header>
  );
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <OnboardingHeader />
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </div>
    </AuthProvider>
  );
}
