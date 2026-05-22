"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function HashScrollHandler() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    scrollToCurrentHash();
  }, [pathname, searchParams]);

  useEffect(() => {
    window.addEventListener("hashchange", scrollToCurrentHash);
    return () => window.removeEventListener("hashchange", scrollToCurrentHash);
  }, []);

  return null;
}

function scrollToCurrentHash() {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (!rawHash) return;

  const targetId = decodeURIComponent(rawHash);
  let attempts = 0;

  const scroll = () => {
    const target = document.getElementById(targetId);
    if (!target) return false;
    target.scrollIntoView({ block: "start", behavior: attempts > 0 ? "smooth" : "auto" });
    return true;
  };

  if (scroll()) return;

  const timer = window.setInterval(() => {
    attempts += 1;
    if (scroll() || attempts >= 12) {
      window.clearInterval(timer);
    }
  }, 75);
}
