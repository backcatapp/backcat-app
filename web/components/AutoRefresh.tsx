"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches server-component data on an interval while `active`. */
export default function AutoRefresh({ every = 5000, active = true }: { every?: number; active?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), every);
    return () => clearInterval(t);
  }, [active, every, router]);
  return null;
}
