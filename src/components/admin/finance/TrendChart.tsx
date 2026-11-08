"use client";

import { useState } from "react";
import { formatMAD } from "@/lib/money";

export type TrendPoint = { label: string; revenue: number; net: number; orders: number };

const W = 640;
const H = 260;
const PAD = { top: 16, right: 12, bottom: 30, left: 52 };
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

/** Sales as a yellow area and net profit as a dashed line, one point per slot; hover or tap a slot to read it. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const [active, setActive] = useState(data.length - 1);
  const n = data.length;
  const max = Math.max(0, ...data.map((d) => Math.max(d.revenue, d.net)));
  const min = Math.min(0, ...data.map((d) => d.net));
  const step = niceStep(max - min || 1);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const bottom = Math.floor(min / step) * step;
  const ticks = Array.from({ length: Math.round((top - bottom) / step) + 1 }, (_, i) => bottom + i * step);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n > 1 ? (i * innerW) / (n - 1) : innerW / 2);
  const y = (v: number) => PAD.top + ((top - v) / (top - bottom)) * innerH;
  const zero = y(0);

  const rev = data.map((d, i) => [x(i), y(d.revenue)] as [number, number]);
  const net = data.map((d, i) => [x(i), y(d.net)] as [number, number]);
  const line = curve(rev);
  const area = `${line} L${x(n - 1)},${zero} L${x(0)},${zero} Z`;
  const every = Math.ceil(n / 7);
  const a = data[active] ?? data[n - 1];

  return (
    <div>
      {/* The slot under the pointer (the latest one by default), read above the chart so it never hides the line. */}
      <div aria-live="polite" className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-ink px-4 py-2.5 text-sm">
        <span className="rounded-md bg-yellow-500 px-2 py-0.5 font-bold text-ink" dir="ltr">
          {a.label}
        </span>
        <span className="text-warm-300">
          المبيعات <b className="text-white">{mad(a.revenue)}</b>
        </span>
        <span className="text-warm-300">
          الصافي <b className="text-white">{mad(a.net)}</b>
        </span>
        <span className="text-warm-300">
          <b className="text-white">{a.orders}</b> طلب
        </span>
      </div>
      <div dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="تطور المبيعات وصافي الربح" onPointerLeave={() => setActive(n - 1)}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--color-yellow-500)", stopOpacity: 0.4 }} />
              <stop offset="100%" style={{ stopColor: "var(--color-yellow-500)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-warm-600" : "stroke-warm-700/60"} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-warm-300 text-[11px]">
                {t.toLocaleString("fr-FR")}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % every === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-warm-300 text-[11px]">
                {d.label}
              </text>
            ) : null,
          )}

          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={zero} className="stroke-warm-600" strokeDasharray="3 4" />
          <path d={area} fill="url(#trend-fill)" />
          <path d={curve(net)} fill="none" className="stroke-warm-300" strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round" />
          <path d={line} fill="none" className="stroke-yellow-500" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          {n <= 31 ? rev.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={i === active ? 6 : 3.5} className="fill-yellow-500 stroke-ink" strokeWidth={i === active ? 3 : 0} />) : (
            <circle cx={rev[active][0]} cy={rev[active][1]} r={6} className="fill-yellow-500 stroke-ink" strokeWidth={3} />
          )}

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

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-warm-300">
        <span className="flex items-center gap-2">
          <span className="h-1 w-5 rounded-full bg-yellow-500" aria-hidden="true" />
          المبيعات المسلَّمة
        </span>
        <span className="flex items-center gap-2">
          <span className="w-5 border-t-2 border-dashed border-warm-300" aria-hidden="true" />
          صافي الربح
        </span>
      </div>

      <table className="sr-only">
        <caption>المبيعات وصافي الربح</caption>
        <thead>
          <tr>
            <th>الفترة</th>
            <th>المبيعات</th>
            <th>صافي الربح</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{mad(d.revenue)}</td>
              <td>{mad(d.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
