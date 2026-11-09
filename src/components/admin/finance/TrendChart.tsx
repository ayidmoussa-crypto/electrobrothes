"use client";

import { useState } from "react";
import { formatMAD } from "@/lib/money";

export type TrendPoint = { label: string; revenue: number; net: number; orders: number };

const W = 640;
const H = 200;
const PAD = { top: 14, right: 12, bottom: 28, left: 52 };
const mad = (v: number) => formatMAD(v, "ar");

/** A round step for about four grid lines. */
function niceStep(span: number) {
  if (span <= 0) return 1;
  const raw = span / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 2.5, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow;
}

/** Smooth line that never overshoots: control points sit halfway, at the height of their own end. */
function curve(points: [number, number][]) {
  return points
    .map(([x, y], i) => {
      if (i === 0) return `M${x},${y}`;
      const [px, py] = points[i - 1];
      const mx = (px + x) / 2;
      return `C${mx},${py} ${mx},${y} ${x},${y}`;
    })
    .join(" ");
}

/**
 * One series over the period: the total on top, then a compact area chart, one point per slot.
 * Hover or tap a slot to read it; the latest one shows by default.
 */
export function TrendChart({ data, metric, label, total }: { data: TrendPoint[]; metric: "revenue" | "net"; label: string; total: number }) {
  const [active, setActive] = useState(data.length - 1);
  const n = data.length;
  const values = data.map((d) => d[metric]);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const step = niceStep(max - min || 1);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const bottom = Math.floor(min / step) * step;
  const ticks = Array.from({ length: Math.round((top - bottom) / step) + 1 }, (_, i) => bottom + i * step);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n > 1 ? (i * innerW) / (n - 1) : innerW / 2);
  const y = (v: number) => PAD.top + ((top - v) / (top - bottom)) * innerH;
  const zero = y(0);

  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = curve(pts);
  const area = `${line} L${x(n - 1)},${zero} L${x(0)},${zero} Z`;
  const every = Math.ceil(n / 6);
  const a = data[active] ?? data[n - 1];
  const gradient = `trend-fill-${metric}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <p>
          <span className="block text-xs text-warm-600">المجموع فالفترة</span>
          <span className={`text-2xl font-extrabold ${total < 0 ? "text-danger" : "text-ink"}`}>{mad(total)}</span>
        </p>
        {/* The slot under the pointer, read beside the total so it never hides the line. */}
        <p aria-live="polite" className="flex items-center gap-2 rounded-full border border-warm-200 bg-white px-3 py-1 text-sm">
          <span className="rounded-md bg-yellow-500 px-1.5 font-bold text-ink" dir="ltr">
            {a.label}
          </span>
          <b className={a[metric] < 0 ? "text-danger" : "text-ink"}>{mad(a[metric])}</b>
          <span className="text-warm-600">· {a.orders} طلب</span>
        </p>
      </div>
      <div dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label} onPointerLeave={() => setActive(n - 1)}>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--color-yellow-500)", stopOpacity: 0.4 }} />
              <stop offset="100%" style={{ stopColor: "var(--color-yellow-500)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-warm-400" : "stroke-warm-200"} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-warm-600 text-[12px]">
                {t.toLocaleString("fr-FR")}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % every === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={H - 6} textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"} className="fill-warm-600 text-[12px]">
                {d.label}
              </text>
            ) : null,
          )}

          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-warm-400" strokeDasharray="3 4" />
          <path d={area} fill={`url(#${gradient})`} />
          <path d={line} fill="none" className="stroke-yellow-700" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={pts[active][0]} cy={pts[active][1]} r={5} className="fill-yellow-500 stroke-ink" strokeWidth={2.5} />

          {/* One invisible column per slot catches the pointer. */}
          {data.map((_, i) => (
            <rect
              key={i}
              x={x(i) - innerW / Math.max(1, n - 1) / 2}
              y={0}
              width={innerW / Math.max(1, n - 1)}
              height={H}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
            />
          ))}
        </svg>
      </div>

      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>الفترة</th>
            <th>{label}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{mad(d[metric])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
