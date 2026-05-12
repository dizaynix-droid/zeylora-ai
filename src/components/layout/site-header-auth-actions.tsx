"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

type AuthState = "loading" | "signed-in" | "signed-out";
type AuthMeResponse = {
  authenticated: boolean;
  user?: {
    email?: string | null;
  };
};

export function SiteHeaderAuthActions() {
  const [authState, setAuthState] = useState<AuthState>("loading");

  const refreshAuthState = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = (await response.json().catch(() => null)) as AuthMeResponse | null;
      setAuthState(response.ok && payload?.authenticated ? "signed-in" : "signed-out");
    } catch {
      setAuthState("signed-out");
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseAuthConfigured()) {
      setAuthState("signed-out");
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    void refreshAuthState();

    void import("@/lib/supabase/client")
      .then(({ createClient }) => {
        if (!mounted) return;

        const supabase = createClient();

        const {
          data: { subscription }
        } = supabase.auth.onAuthStateChange(() => {
          if (!mounted) return;
          void refreshAuthState();
        });

        unsubscribe = () => subscription.unsubscribe();
      })
      .catch(() => {
        if (mounted) {
          setAuthState("signed-out");
        }
      });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [refreshAuthState]);

  const isSignedIn = authState === "signed-in";

  return (
    <div className="flex items-center gap-2">
      {authState === "loading" ? (
        <span className="hidden h-10 w-20 animate-pulse rounded-full border border-white/10 bg-white/[0.06] sm:inline-flex" />
      ) : isSignedIn ? (
        <>
          <Button href="/dashboard" variant="ghost" className="hidden sm:inline-flex">
            Dashboard
          </Button>
          <form action="/auth/sign-out" method="post" className="hidden md:block">
            <button className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white">
              Sign out
            </button>
          </form>
        </>
      ) : (
        <Button href="/auth/sign-in" variant="ghost" className="hidden sm:inline-flex">
          Sign in
        </Button>
      )}

      <Button href="/#upload" className="px-4">
        Upload
      </Button>

      <Link
        href={isSignedIn ? "/dashboard" : "/auth/sign-in"}
        className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/15 md:hidden"
        aria-label={isSignedIn ? "Open dashboard" : "Sign in"}
      >
        <UserCircle size={18} />
      </Link>
    </div>
  );
}
