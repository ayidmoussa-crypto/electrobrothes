// The night sky behind the hero. It is composed, not scattered: a seeded generator gives the same sky on every visit,
// the stars gather along one diagonal band that leans like the logo's bolt, they thin out under the text so it stays
// readable, and three real constellations are drawn in hairlines where nothing else sits.

export type SkyColors = { white: string; warm: string; yellow: string; line: string; glow: string };
export type TwinkleStar = { x: number; y: number; size: number; tone: 0 | 1 };

/** Small seeded generator: same numbers, same sky. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Real star patterns, as fractions of the constellation's own box, with the lines that join them.
const DIPPER = {
  stars: [[0, 0.32], [0.17, 0.2], [0.32, 0.27], [0.5, 0.36], [0.58, 0.68], [0.94, 0.72], [1, 0.34]],
  lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
};
const CASSIOPEIA = {
  stars: [[0, 0.2], [0.26, 0.82], [0.5, 0.4], [0.74, 1], [1, 0.1]],
  lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
};
const ORION = {
  stars: [[0.1, 0], [0.86, 0.1], [0.38, 0.48], [0.5, 0.52], [0.62, 0.56], [0, 1], [0.94, 0.96]],
  lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
};

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Paints the still sky on `ctx` (w x h CSS pixels) and returns the bright stars that twinkle over it. */
export function paintSky(ctx: CanvasRenderingContext2D, w: number, h: number, rtl: boolean, colors: SkyColors): TwinkleStar[] {
  const random = seeded(20261105);
  const phone = w < 768;
  ctx.clearRect(0, 0, w, h);

  // Mirrors a position for English, where the text and the product swap sides.
  const mx = (x: number) => (rtl ? x : 1 - x);

  // The band runs from bottom to top, leaning like the bolt, and passes behind the product.
  const bandX = (fy: number) => mx(phone ? 0.5 + (0.5 - fy) * 0.5 : 0.3 + (0.56 - fy) * 0.45);
  const bandFalloff = phone ? 0.3 : 0.2;

  // Milky glow along the band: the faintest wash of warm light, so the sky has depth without a new colour.
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i <= 8; i++) {
    const fy = i / 8;
    const cx = bandX(fy) * w;
    const cy = fy * h;
    const r = Math.max(w * bandFalloff, 180);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    glow.addColorStop(0, colors.glow);
    glow.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = "source-over";

  // Under the text the sky goes quiet: full strength opposite it, a fifth of it behind it.
  const textCalm = (fx: number, fy: number) => {
    if (phone) return fy > 0.56 ? 0.25 : 1;
    const towardText = rtl ? fx : 1 - fx;
    return towardText < 0.5 ? 1 : Math.max(0.2, 1 - (towardText - 0.5) * 4);
  };

  // Fine dust, kept or dropped by its distance from the band.
  const dust = phone ? 420 : 1300;
  for (let placed = 0, tries = 0; placed < dust && tries < dust * 12; tries++) {
    const fx = random();
    const fy = random();
    const away = Math.abs(fx - bandX(fy)) / bandFalloff;
    const keep = 0.14 + 0.86 * Math.exp(-away * away);
    if (random() > keep) continue;
    placed++;
    const r = 0.35 + random() * 0.55;
    dot(ctx, fx * w, fy * h, r, random() < 0.7 ? colors.warm : colors.white, (0.2 + random() * 0.55) * textCalm(fx, fy));
  }

  // Hairline constellations, each in a space of its own and scaled to fit.
  // Phones have no free space for them: the product and the text take the whole height.
  const size = 0.17;
  const placements = phone
    ? []
    : [
        { c: DIPPER, x: 0.46, y: 0.24, s: 1 },
        { c: CASSIOPEIA, x: 0.72, y: 0.22, s: 0.7 },
        { c: ORION, x: 0.46, y: 0.72, s: 0.7 },
      ];
  for (const { c, x, y, s } of placements) {
    const bw = w * size * s;
    const bh = bw * 0.62;
    const points = c.stars.map(([px, py]) => {
      const fx = x + (px * bw) / w;
      return [mx(fx) * w, y * h + py * bh];
    });
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [a, b] of c.lines) {
      ctx.moveTo(points[a][0], points[a][1]);
      ctx.lineTo(points[b][0], points[b][1]);
    }
    ctx.stroke();
    for (const [px, py] of points) dot(ctx, px, py, 1.5, colors.white, 0.95);
  }
  ctx.globalAlpha = 1;

  // Bright stars, placed on the band and away from the text. They are drawn each frame, so they can twinkle.
  const bright: TwinkleStar[] = [];
  const wanted = phone ? 22 : 60;
  for (let tries = 0; bright.length < wanted && tries < wanted * 40; tries++) {
    const fx = random();
    const fy = random();
    const away = Math.abs(fx - bandX(fy)) / bandFalloff;
    if (random() > Math.exp(-away * away * 0.5) || textCalm(fx, fy) < 0.6) continue;
    bright.push({ x: fx * w, y: fy * h, size: 5 + random() * 6, tone: random() < 0.16 ? 0 : 1 });
  }
  return bright;
}
