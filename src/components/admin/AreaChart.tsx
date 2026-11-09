"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

type Point = { key: string; label: string; value: number };

// Single-series area chart in SVG: brand-yellow gradient fill, Yellow 700 line (≥3:1 on white),
// recessive grid, a crosshair + tooltip on hover and with the arrow keys, and a table view for
// screen readers. Time runs right to left (Arabic): the oldest day is on the right.
const H = 180;
const PAD_TOP = 12;

const TEXT = {
  ar: { total: "المجموع", peak: "الذروة", table: "عرض كجدول" },
  en: { total: "Total", peak: "Peak", table: "Show as table" },
};

/** `lang="en"` writes the chart in English and runs time left to right. */
export function AreaChart({ title, data, unit = "طلب", lang = "ar", className = "" }: { title: string; data: Point[]; unit?: string; lang?: "ar" | "en"; className?: string }) {
  const t = TEXT[lang];
  const rtl = lang === "ar";
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(600);

  // Fewer dates on narrow screens: roughly one per 90px so "27 أكتوبر" and "1 نونبر" never touch.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.value));
  // A round, even top for the scale (2, 4, 6, 10, 20, 40…) so the middle gridline is a whole number.
  const step = 10 ** Math.floor(Math.log10(max));
  const top = [2, 4, 6, 10].map((m) => m * step).find((v) => v >= max) ?? max;

  // x in 0–100 (percent of the width), RTL: index 0 (oldest) at 100.
  const x = (i: number) => (n === 1 ? 50 : rtl ? 100 - (i / (n - 1)) * 100 : (i / (n - 1)) * 100);
  const y = (v: number) => PAD_TOP + (H - PAD_TOP) * (1 - v / top);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(n - 1)},${H} L${x(0)},${H} Z`;

  // Dated ticks; the first and last are pinned to the edges so they never get cut.
  const tickCount = Math.min(6, Math.max(2, Math.floor(width / 90)));
  const tickEvery = Math.max(1, Math.round((n - 1) / (tickCount - 1)));
  const ticks = data.map((d, i) => ({ i, label: d.label })).filter(({ i }) => i % tickEvery === 0 || i === n - 1);
  if (ticks.length > 1 && ticks[ticks.length - 1].i - ticks[ticks.length - 2].i < tickEvery / 2) ticks.splice(ticks.length - 2, 1);

  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
  const total = data.reduce((s, d) => s + d.value, 0);

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // Share of the width from the oldest day's edge.
    const fromStart = rtl ? (r.right - e.clientX) / r.width : (e.clientX - r.left) / r.width;
    setActive(Math.min(n - 1, Math.max(0, Math.round(fromStart * (n - 1)))));
  };
  const onKey = (e: KeyboardEvent) => {
    // Arrow keys follow the visual direction (in Arabic: left = newer, right = older).
    const move = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, Home: -n, End: n }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    setActive((a) => Math.min(n - 1, Math.max(0, (a ?? n - 1) + move)));
  };

  const cur = active === null ? null : data[active];

  return (
    <figure className={`admin-card p-4 md:p-5 ${className}`}>
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-ink">{title}</span>
        <span className="text-xs text-warm-600">
          {t.total}: <b className="text-ink">{total}</b> {unit}
        </span>
      </figcaption>

      <div className="relative mt-3 ps-8">
        {/* Y scale: three recessive gridlines with their values. */}
        {[0, 0.5, 1].map((f) => (
          <div key={f} aria-hidden="true" className="pointer-events-none absolute inset-x-0 flex items-center gap-2" style={{ top: y(top * f) - 7 }}>
            <span className="w-6 text-end text-[11px] text-warm-500 tabular-nums">{Math.round(top * f)}</span>
            <span className="h-px flex-1 border-t border-dashed border-warm-200" />
          </div>
        ))}

        <div
          ref={box}
          tabIndex={0}
          role="img"
          aria-label={`${title}: ${t.total} ${total} ${unit}${peak && peak.value ? `، ${t.peak} ${peak.label} (${peak.value})` : ""}`}
          aria-describedby={cur ? `${id}-tip` : undefined}
          onPointerMove={pick}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? n - 1)}
          onBlur={() => setActive(null)}
          className="relative cursor-crosshair rounded-md outline-offset-4"
          style={{ height: H }}
        >
          <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
            <defs>
              <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-yellow-500)" stopOpacity="0.55" />
                <stop offset="100%" stopColor="var(--color-yellow-500)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${id}-fill)`} />
            <path d={line} fill="none" stroke="var(--color-yellow-700)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {cur && active !== null ? (
              <line x1={x(active)} x2={x(active)} y1={PAD_TOP} y2={H} stroke="var(--color-ink)" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ) : null}
          </svg>

          {cur && active !== null ? (
            <>
              {/* Marker: ink dot ringed in the card surface so it reads on the line. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink"
                style={{ left: `${x(active)}%`, top: y(cur.value) }}
              />
              <span
                id={`${id}-tip`}
                role="status"
                className="pointer-events-none absolute z-10 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
                style={{
                  top: y(cur.value) - 10,
                  // Keep the tooltip inside the chart near either edge.
                  ...(x(active) > 70 ? { right: `${100 - x(active)}%` } : x(active) < 30 ? { left: `${x(active)}%` } : { left: `${x(active)}%`, translate: "-50% -100%" }),
                }}
              >
                {cur.label} · <b>{cur.value}</b> {unit}
              </span>
            </>
          ) : null}
        </div>

        {/* X axis: whole dates ("31 أكتوبر"), never truncated; edge labels hug the edges. */}
        <div aria-hidden="true" className="relative mt-2 h-4 text-[11px] text-warm-600">
          {ticks.map(({ i, label }) => {
            const pos = x(i);
            const style = pos >= 99 ? { right: 0 } : pos <= 1 ? { left: 0 } : { left: `${pos}%`, translate: "-50% 0" };
            return (
              <span key={i} className="absolute top-0 whitespace-nowrap" style={style}>
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {peak && peak.value > 0 ? (
        <p className="mt-3 text-xs text-warm-600">
          {t.peak}: {peak.label} ({peak.value})
        </p>
      ) : null}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-warm-600">{t.table}</summary>
        <table className="mt-2 w-full text-start">
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-b border-warm-200/60">
                <th scope="row" className="py-1 text-start font-normal text-warm-600">
                  {d.label}
                </th>
                <td className="py-1 font-semibold text-ink">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
