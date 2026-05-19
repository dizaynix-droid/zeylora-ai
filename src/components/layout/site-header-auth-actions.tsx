"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { UserCircle } from "lucide-react";
import { VerifyAction } from "@/components/verify-ui/core";
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

  function handleUploadClick(event: MouseEvent<HTMLAnchorElement>) {
    if (typeof window === "undefined") return;

    if (window.location.pathname === "/dashboard") {
      event.preventDefault();
      const uploadPanel = document.getElementById("verify");
      uploadPanel?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      return;
    }

    event.preventDefault();
    window.location.href = isSupabaseAuthConfigured() ? "/dashboard#verify" : "/auth/sign-in?next=/dashboard%23verify";
  }

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
        <span className="hidden h-10 w-20 animate-pulse rounded-lg border border-slate-200 bg-slate-100 sm:inline-flex" />
      ) : isSignedIn ? (
        <>
          <VerifyAction href="/dashboard" variant="quiet" className="hidden sm:inline-flex">
            Dashboard
          </VerifyAction>
          <form action="/auth/sign-out" method="post" className="hidden md:block">
            <button className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950">
              Sign out
            </button>
          </form>
        </>
      ) : (
        <VerifyAction href="/auth/sign-in" variant="quiet" className="hidden sm:inline-flex">
          Sign in
        </VerifyAction>
      )}

      <Link
        href="/dashboard#verify"
        onClick={handleUploadClick}
        className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Verify list
      </Link>

      <Link
        href={isSignedIn ? "/dashboard" : "/auth/sign-in"}
        className="grid size-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 md:hidden"
        aria-label={isSignedIn ? "Open dashboard" : "Sign in"}
      >
        <UserCircle size={18} />
      </Link>
    </div>
  );
}
