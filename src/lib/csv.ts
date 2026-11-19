// CSV for Excel in Morocco: ";" separator (French/Arabic Excel locales), UTF-8 BOM so Arabic
// opens correctly, and protection against formula injection from customer-typed fields.

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined) {
  let s = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && FORMULA_START.test(s)) s = `'${s}`;
  // Quoted on "," and TAB too: a sheet opened with a comma or tab separator must still read the value as one cell,
  // or "x,=1+1" would start a new cell with a formula the prefix above never saw.
  return /[;,"\n\r\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}
