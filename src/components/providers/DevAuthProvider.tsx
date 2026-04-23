"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// ── DEV-ONLY credentials ─────────────────────────────────
// Replace this with real auth when building the login flow.
const DEV_EMAIL = "demo@fashnix.com";
const DEV_PASSWORD = "12345678";

const AuthContext = createContext<Session | null>(null);

export function useSession() {
  return useContext(AuthContext);
}

export function DevAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function ensureSession() {
      // 1. Check for an existing session
      const {
        data: { session: existing },
      } = await supabase.auth.getSession();

      if (existing) {
        setSession(existing);
        setReady(true);
        return;
      }

      // 2. No session — sign in with the dev test user
      const { data, error } = await supabase.auth.signInWithPassword({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
      });

      if (error) {
        console.error(
          "[DevAuth] Auto sign-in failed. Make sure the test user exists in Supabase → Authentication → Users.",
          error.message
        );
      }

      setSession(data.session);
      setReady(true);
    }

    ensureSession();

    // Keep session in sync when tokens refresh / user signs out
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={session}>{children}</AuthContext.Provider>
  );
}
