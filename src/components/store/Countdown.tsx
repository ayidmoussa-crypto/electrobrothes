"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

// One shared 1s ticker for every countdown on the page.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(cb: () => void) {
  listeners.add(cb);
  timer ??= setInterval(() => listeners.forEach((l) => l()), 1000);
  return () => {
    listeners.delete(cb);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
const nowSeconds = () => Math.floor(Date.now() / 1000);

/** `dark`: ink tiles on a light surface. `light`: white tiles. `glass`: ink tiles inside a dark glass card. */
export function Countdown({ endsAt, tone = "dark" }: { endsAt: string; tone?: "dark" | "light" | "glass" }) {
  const t = useTranslations("countdown");
  // Server render shows placeholders; the real time appears after hydration (no mismatch).
  const now = useSyncExternalStore(subscribe, nowSeconds, () => null);
  const left = now === null ? null : Math.max(0, Math.floor(new Date(endsAt).getTime() / 1000) - now);

  if (left === 0) return <p className={`text-sm font-semibold ${tone === "glass" ? "text-warm-300" : "text-warm-600"}`}>{t("ended")}</p>;

  const parts = [
    [left === null ? null : Math.floor(left / 86400), t("days")],
    [left === null ? null : Math.floor((left % 86400) / 3600), t("hours")],
    [left === null ? null : Math.floor((left % 3600) / 60), t("minutes")],
    [left === null ? null : left % 60, t("seconds")],
  ] as const;

  return (
    // Announcing every second would flood screen readers, so the ticking digits are not a live region.
    // Days → seconds in the reading direction (right-to-left in Arabic).
    <div className="flex gap-2">
      {parts.map(([value, label]) => (
        <div
          key={label}
          className={`flex min-w-14 flex-col items-center rounded-lg px-2 py-1.5 ${tone === "light" ? "bg-white text-ink" : "bg-ink text-white"}`}
        >
          <span className="text-xl font-extrabold tabular-nums">{value === null ? "--" : String(value).padStart(2, "0")}</span>
          <span className={`text-[11px] ${tone === "light" ? "text-warm-600" : "text-warm-300"}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}
