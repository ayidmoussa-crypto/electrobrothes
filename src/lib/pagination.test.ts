import assert from "node:assert/strict";
import { test } from "node:test";
import { clampPage, pageCount, pageItems, pageRange, parsePage } from "./pagination";

test("the page in the address is a whole number from 1, else page 1", () => {
  assert.equal(parsePage("3"), 3);
  for (const bad of [undefined, "", "0", "-2", "1.5", "abc", ["2"], null]) assert.equal(parsePage(bad), 1);
  assert.equal(parsePage("99999999"), 100_000);
});

test("page count and clamping", () => {
  assert.equal(pageCount(0, 25), 1);
  assert.equal(pageCount(25, 25), 1);
  assert.equal(pageCount(26, 25), 2);
  assert.equal(clampPage(9, 60, 25), 3);
  assert.equal(clampPage(2, 60, 25), 2);
  assert.equal(clampPage(5, 0, 25), 1);
});

test("the numbered row keeps the ends and the neighbours, and shows a gap only where pages are hidden", () => {
  assert.deepEqual(pageItems(1, 1), [1]);
  assert.deepEqual(pageItems(2, 4), [1, 2, 3, 4]);
  assert.deepEqual(pageItems(1, 10), [1, 2, "gap", 10]);
  assert.deepEqual(pageItems(5, 10), [1, "gap", 4, 5, 6, "gap", 10]);
  assert.deepEqual(pageItems(3, 10), [1, 2, 3, 4, "gap", 10]);
  assert.deepEqual(pageItems(10, 10), [1, "gap", 9, 10]);
});

test("the range of rows a page shows", () => {
  assert.deepEqual(pageRange(1, 25, 60), { from: 1, to: 25 });
  assert.deepEqual(pageRange(3, 25, 60), { from: 51, to: 60 });
  assert.deepEqual(pageRange(1, 25, 0), { from: 0, to: 0 });
});
