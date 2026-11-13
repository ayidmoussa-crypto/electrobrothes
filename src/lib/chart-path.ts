const r = (v: number) => Math.round(v * 100) / 100;

/**
 * An SVG path through the points as a soft curve that never overshoots (monotone cubic, Fritsch–Carlson):
 * a day with no orders stays on the baseline instead of dipping under it. Works when x runs right to left too.
 */
export function smoothPath(pts: [number, number][]) {
  const n = pts.length;
  if (n < 3) return pts.map(([x, y], i) => `${i ? "L" : "M"}${r(x)},${r(y)}`).join(" ");
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const m = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
  const t = pts.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${r(pts[0][0])},${r(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    d += ` C${r(x0 + h)},${r(y0 + t[i] * h)} ${r(x1 - h)},${r(y1 - t[i + 1] * h)} ${r(x1)},${r(y1)}`;
  }
  return d;
}
