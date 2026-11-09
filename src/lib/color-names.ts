// Names a product colour from its swatch, so the owner only picks a colour and the shop still has words for the cart,
// orders, WhatsApp messages and screen readers. These hex values are catalog data (product colours), not UI colours.
/* eslint-disable no-restricted-syntax */

type Named = { hex: string; ar: string; en: string };

const PALETTE: Named[] = [
  { hex: "#111111", ar: "أسود", en: "Black" },
  { hex: "#3a3a3c", ar: "رمادي داكن", en: "Graphite" },
  { hex: "#8e8e93", ar: "رمادي", en: "Grey" },
  { hex: "#8a8580", ar: "تيتانيوم", en: "Titanium" },
  { hex: "#c7c7cc", ar: "فضي", en: "Silver" },
  { hex: "#f5f5f5", ar: "أبيض", en: "White" },
  { hex: "#e8dcc4", ar: "بيج", en: "Beige" },
  { hex: "#d4af37", ar: "ذهبي", en: "Gold" },
  { hex: "#e8b4a0", ar: "وردي ذهبي", en: "Rose gold" },
  { hex: "#f4a6c0", ar: "وردي", en: "Pink" },
  { hex: "#d32f2f", ar: "أحمر", en: "Red" },
  { hex: "#7b1e2b", ar: "عنابي", en: "Burgundy" },
  { hex: "#f57c00", ar: "برتقالي", en: "Orange" },
  { hex: "#fbc02d", ar: "أصفر", en: "Yellow" },
  { hex: "#388e3c", ar: "أخضر", en: "Green" },
  { hex: "#a8e6cf", ar: "أخضر فاتح", en: "Mint" },
  { hex: "#6b7a3a", ar: "زيتي", en: "Olive" },
  { hex: "#00897b", ar: "فيروزي", en: "Teal" },
  { hex: "#90caf9", ar: "أزرق فاتح", en: "Light blue" },
  { hex: "#1e63d6", ar: "أزرق", en: "Blue" },
  { hex: "#1a2a4f", ar: "كحلي", en: "Navy" },
  { hex: "#7b3fa0", ar: "بنفسجي", en: "Purple" },
  { hex: "#c3b1e1", ar: "بنفسجي فاتح", en: "Lavender" },
  { hex: "#6d4c41", ar: "بني", en: "Brown" },
];

/** sRGB hex to CIE Lab, where distances match what the eye sees. */
function lab(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin;
  const xyz = [(r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, r * 0.2126 + g * 0.7152 + b * 0.0722, (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883];
  const [x, y, z] = xyz.map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const PALETTE_LAB = PALETTE.map((p) => ({ ...p, lab: lab(p.hex) }));
/** The closest named colour to a swatch. */
export function colorName(hex: string): { ar: string; en: string } {
  const [l, a, b] = lab(hex.toLowerCase());
  let best = PALETTE_LAB[0];
  let bestD = Infinity;
  for (const p of PALETTE_LAB) {
    const d = (p.lab[0] - l) ** 2 + (p.lab[1] - a) ** 2 + (p.lab[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return { ar: best.ar, en: best.en };
}

/**
 * Names every colour of a product from its swatch. Two different swatches that land on the same name are numbered
 * ("Blue", "Blue 2") so the customer and the orders can still tell them apart. A colour without a swatch keeps its name.
 */
export function nameColors<T extends { colorHex: string | null; colorAr: string | null; colorEn: string | null }>(variants: T[]): T[] {
  const seen = new Map<string, { hex: string; count: number }[]>();
  const byHex = new Map<string, { ar: string; en: string }>();
  return variants.map((v) => {
    if (!v.colorHex) return v;
    const hex = v.colorHex.toLowerCase();
    let name = byHex.get(hex);
    if (!name) {
      const base = colorName(hex);
      const taken = seen.get(base.en) ?? [];
      const n = taken.length + 1;
      taken.push({ hex, count: n });
      seen.set(base.en, taken);
      name = n === 1 ? base : { ar: `${base.ar} ${n}`, en: `${base.en} ${n}` };
      byHex.set(hex, name);
    }
    return { ...v, colorAr: name.ar, colorEn: name.en };
  });
}
