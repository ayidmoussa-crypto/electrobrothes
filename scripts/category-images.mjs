// Cuts one real product photo per category out of its white background, for the round categories on the
// home page: public/categories/<slug>.webp. Run once by hand when a photo changes: node scripts/category-images.mjs
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const CLOUD = "https://res.cloudinary.com/bicda67p/image/upload/f_png,w_1000";
const PHOTOS = {
  headphones: "v1793803662/electrobrothers/products/soundcore-q45-1.jpg",
  smartwatches: "v1793803700/electrobrothers/products/haylou-solare-pro-smartwatch-1.webp",
  chargers: "v1793803671/electrobrothers/products/anker-zolo-30w-adapteur-1.avif",
  "power-banks": "v1793803693/electrobrothers/products/ugreen-power-bank-magnetique-sans-fil-10000mah-20w-1.jpg",
  "other-devices": "v1793803772/electrobrothers/products/soundcore-glow-speaker-1.webp",
  "phone-cases": "v1793803738/electrobrothers/products/kajsa-case-17-pro-max-1.webp",
};
// The speaker's light spills across the white floor: keep only its body, as fractions of the cut-out [left, top, right, bottom].
const BODY = { "other-devices": [0.09, 0, 0.52, 0.885] };
const WHITE = 238; // A pixel this bright on all channels counts as background...
const SOFT = 215; // ...and from here up to WHITE it fades out at the product's edge.

// Products with a see-through gap closed on all sides (a headband, a watch strap). Elsewhere white inside is part of the product.
const GAPS = new Set(["headphones", "smartwatches"]);
const MIN_GAP = 0.002; // Share of the photo: anything smaller is a reflection or a white digit, not a gap.

/** One seed per white area of a meaningful size that does not touch the photo's border. */
function gapSeeds(light, w, h) {
  const seen = new Uint8Array(w * h);
  const seeds = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || light(start) < WHITE) continue;
    let size = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      size++;
      const x = i % w;
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1]) {
        if (n >= 0 && !seen[n] && light(n) >= WHITE) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (size >= MIN_GAP * w * h) seeds.push(start);
  }
  return seeds;
}

/** Clears the white connected to the photo's border, so white parts inside the product stay, plus any gaps asked for. */
function cutOut({ data, info }, withGaps) {
  const { width: w, height: h } = info;
  const light = (i) => Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, x + (h - 1) * w);
  for (let y = 0; y < h; y++) stack.push(y * w, w - 1 + y * w);
  if (withGaps) stack.push(...gapSeeds(light, w, h));
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || light(i) < SOFT) continue;
    seen[i] = 1;
    const x = i % w;
    data[i * 4 + 3] = light(i) >= WHITE ? 0 : Math.round(((WHITE - light(i)) / (WHITE - SOFT)) * data[i * 4 + 3]);
    if (light(i) < WHITE) continue; // The soft band is the edge: do not spread through it.
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  keepLargestPart(data, w, h);
  return sharp(data, { raw: { width: w, height: h, channels: 4 } });
}

/** Removes small marks floating beside the product (arrows, specks): only the biggest connected shape stays. */
function keepLargestPart(data, w, h) {
  const label = new Int32Array(w * h);
  const sizes = [0];
  for (let start = 0; start < w * h; start++) {
    if (label[start] || data[start * 4 + 3] === 0) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const i = stack.pop();
      size++;
      const x = i % w;
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1]) {
        if (n >= 0 && !label[n] && data[n * 4 + 3] !== 0) {
          label[n] = id;
          stack.push(n);
        }
      }
    }
    sizes.push(size);
  }
  const biggest = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < w * h; i++) if (label[i] !== biggest) data[i * 4 + 3] = 0;
}

mkdirSync("public/categories", { recursive: true });
for (const [slug, path] of Object.entries(PHOTOS)) {
  const res = await fetch(`${CLOUD}/${path}`);
  if (!res.ok) throw new Error(`${slug}: ${res.status}`);
  const raw = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithFile: false, resolveWithObject: true });
  const png = await cutOut(raw, GAPS.has(slug)).png().toBuffer();
  let trimmed = await sharp(png).trim({ threshold: 1 }).png().toBuffer();
  if (BODY[slug]) {
    const { width, height } = await sharp(trimmed).metadata();
    const [l, t, r, b] = BODY[slug];
    const box = { left: Math.round(l * width), top: Math.round(t * height), width: Math.round((r - l) * width), height: Math.round((b - t) * height) };
    const round = Buffer.from(`<svg width="${box.width}" height="${box.height}"><rect width="100%" height="100%" rx="${box.width * 0.42}" ry="${box.width * 0.13}"/></svg>`);
    trimmed = await sharp(trimmed).extract(box).composite([{ input: round, blend: "dest-in" }]).png().toBuffer();
  }
  const out = await sharp(trimmed).resize(520, 520, { fit: "inside" }).webp({ quality: 84, alphaQuality: 90 }).toFile(`public/categories/${slug}.webp`);
  console.log(slug, `${out.width}x${out.height}`, `${Math.round(out.size / 1024)} KB`);
}
