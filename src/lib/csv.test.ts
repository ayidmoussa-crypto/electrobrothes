import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, toCsv } from "./csv";

test("quotes cells that contain the separator, quotes or line breaks", () => {
  assert.equal(csvCell("Rue 12; Bloc A"), '"Rue 12; Bloc A"');
  assert.equal(csvCell('5" screen'), '"5"" screen"');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell("الدار البيضاء"), "الدار البيضاء");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(7333), "7333");
});

test("neutralises spreadsheet formulas typed by customers", () => {
  assert.equal(csvCell("=HYPERLINK(\"http://x\")"), "\"'=HYPERLINK(\"\"http://x\"\")\"");
  assert.equal(csvCell("+212600000000"), "'+212600000000");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  // Negative numbers passed as numbers are data, not formulas.
  assert.equal(csvCell(-5), "-5");
});

test("starts with a BOM and uses CRLF rows", () => {
  assert.equal(toCsv([["a", "b"], [1, 2]]), "﻿a;b\r\n1;2");
});
