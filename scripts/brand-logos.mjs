// Generates brand logos for the home page strip: public/brands/<slug>.svg in each brand's own colour,
// plus src/data/brand-logos.json listing which slugs have a logo.
// Logos come from Simple Icons (CC0, https://simpleicons.org); brands it lacks get a plain wordmark.
// Re-run after adding a brand: node scripts/brand-logos.mjs
import fs from "node:fs";
import * as si from "simple-icons";

// Our brand slug → Simple Icons slug (when they differ) and colour fixes for a white background.
const ICONS = {
  apple: {},
  samsung: {},
  xiaomi: {},
  jbl: {},
  sony: { hex: "000000" }, // Simple Icons uses white
  honor: {},
  hp: {},
  dell: {},
  asus: {},
  lenovo: {},
};
// Not in Simple Icons: wordmark in the brand colour.
const WORDMARKS = {
  anker: { text: "ANKER", hex: "00A7E1" },
  baseus: { text: "Baseus", hex: "1A1A1A" },
  soundcore: { text: "soundcore", hex: "00A7E1" },
  ugreen: { text: "UGREEN", hex: "16A34A" },
  edifier: { text: "EDIFIER", hex: "1A1A1A" },
  haylou: { text: "HAYLOU", hex: "1A1A1A" },
  amazfit: { text: "amazfit", hex: "1A1A1A" },
  qcy: { text: "QCY", hex: "1A1A1A" },
};

// Real drawing boxes [x, y, w, h], measured with getBBox() in the browser. Simple Icons draw every
// logo inside a 24×24 square, so a wordmark like Samsung only fills a thin band of it; cropping
// to the box makes all logos look the same size in the strip.
const BOXES = {
  apple: [2.22, 0, 19.55, 24], samsung: [0, 10.17, 24, 3.67], xiaomi: [0, 0, 24, 24], jbl: [0, 5.26, 24, 13.47],
  sony: [0, 9.89, 24, 4.22], honor: [0, 9.69, 24, 4.62], hp: [0, 0, 24, 24], dell: [0, 0, 24, 24],
  asus: [0, 9.52, 24, 4.96], lenovo: [0, 8, 24, 8.01],
  anker: [-6.22, -2.35, 97.29, 33.72], baseus: [0.49, -2.33, 99.01, 33.83], soundcore: [1.37, -2.34, 142.25, 33.83],
  ugreen: [-8.15, -2.33, 116.31, 33.83], edifier: [2.41, -2.45, 110.18, 33.92], haylou: [-6.94, -2.33, 113.87, 33.83],
  amazfit: [7.08, -2.45, 100.84, 33.92], qcy: [-1.91, -2.4, 58.83, 33.83],
};
const viewBox = (slug, fallback) => {
  const [x, y, w, h] = BOXES[slug] ?? fallback;
  const pad = h * 0.04;
  return { box: [x - pad, y - pad, w + 2 * pad, h + 2 * pad].map((n) => +n.toFixed(2)).join(" "), ratio: +((w + 2 * pad) / (h + 2 * pad)).toFixed(2) };
};

const icons = Object.values(si).filter((i) => i && typeof i === "object" && "slug" in i);
fs.mkdirSync("public/brands", { recursive: true });
const manifest = {};

for (const [slug, opt] of Object.entries(ICONS)) {
  const icon = icons.find((i) => i.slug === (opt.slug ?? slug));
  if (!icon) throw new Error(`Simple Icons has no "${slug}"`);
  const { box, ratio } = viewBox(slug, [0, 0, 24, 24]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" role="img" aria-label="${icon.title}"><path fill="#${opt.hex ?? icon.hex}" d="${icon.path}"/></svg>`;
  fs.writeFileSync(`public/brands/${slug}.svg`, svg);
  manifest[slug] = { ratio };
}

for (const [slug, { text, hex }] of Object.entries(WORDMARKS)) {
  const { box, ratio } = viewBox(slug, [0, -2.4, text.length * 15 + 10, 33.8]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" role="img" aria-label="${text}"><text x="${(BOXES[slug]?.[0] ?? 0) + (BOXES[slug]?.[2] ?? text.length * 15 + 10) / 2}" y="24" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" letter-spacing="0.5" fill="#${hex}">${text}</text></svg>`;
  fs.writeFileSync(`public/brands/${slug}.svg`, svg);
  manifest[slug] = { ratio };
}

fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/brand-logos.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${Object.keys(manifest).length} logos`);
