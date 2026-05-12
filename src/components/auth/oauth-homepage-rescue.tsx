"use client";

import { useEffect } from "react";

export function OAuthHomepageRescue() {
  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const hasAuthCode = currentUrl.searchParams.has("code");
    const hasAuthError = currentUrl.searchParams.has("error") || currentUrl.searchParams.has("error_description");

    if (!hasAuthCode && !hasAuthError) return;

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    currentUrl.searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });

    if (!callbackUrl.searchParams.has("next")) {
      callbackUrl.searchParams.set("next", "/#upload");
    }

    window.location.replace(callbackUrl.toString());
  }, []);

  return null;
}
