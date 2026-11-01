// Converts each page of brand/logobrand.pdf to SVG (text as paths) + a PNG preview.
// Usage: node scripts/logo-to-svg.mjs [outDir]
import fs from "node:fs";
import path from "node:path";
import * as mupdf from "mupdf";

const outDir = process.argv[2] ?? "brand/export";
fs.mkdirSync(outDir, { recursive: true });

const doc = mupdf.Document.openDocument(
  fs.readFileSync("brand/logobrand.pdf"),
  "application/pdf",
);

for (let i = 0; i < doc.countPages(); i++) {
  const page = doc.loadPage(i);
  const name = path.join(outDir, `logo-p${i + 1}`);

  const buf = new mupdf.Buffer();
  const writer = new mupdf.DocumentWriter(buf, "svg", "text=path");
  page.run(writer.beginPage(page.getBounds()), mupdf.Matrix.identity);
  writer.endPage();
  writer.close();
  fs.writeFileSync(`${name}.svg`, buf.asUint8Array());

  const png = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, true);
  fs.writeFileSync(`${name}.png`, png.asPNG());

  console.log(`page ${i + 1}: ${page.getBounds().map(Math.round).join(",")} -> ${name}.svg`);
}
