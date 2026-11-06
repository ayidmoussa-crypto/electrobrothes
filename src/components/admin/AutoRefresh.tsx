"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Keeps a live page (the inbox) current while it is on screen, without a socket server. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, seconds * 1000);
    return () => clearInterval(tick);
  }, [router, seconds]);
  return null;
}
