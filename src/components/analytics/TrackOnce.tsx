"use client";

import { useEffect, useRef } from "react";
import { track, type TrackEvent } from "@/lib/analytics";

/**
 * Sends one event when it mounts. With `onceKey`, it is sent once per browser session
 * (a reloaded confirmation page must not count the purchase twice).
 */
export function TrackOnce({ event, onceKey }: { event: TrackEvent; onceKey?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (onceKey) {
      try {
        if (sessionStorage.getItem(onceKey)) return;
        sessionStorage.setItem(onceKey, "1");
      } catch {}
    }
    track(event);
  }, [event, onceKey]);
  return null;
}
