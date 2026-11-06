import assert from "node:assert/strict";
import { test } from "node:test";
import { rankTopUp } from "./top-up";

const prices = (list: { price: number }[]) => list.map((p) => p.price);
const products = [100, 300, 90, 1500, 280, 50].map((price) => ({ price }));

test("what closes the gap for the least money comes first, then what comes closest", () => {
  assert.deepEqual(prices(rankTopUp(products, 280, 10)), [280, 300, 1500, 100, 90, 50]);
});

test("the list is cut to the size asked for", () => {
  assert.deepEqual(prices(rankTopUp(products, 280, 2)), [280, 300]);
});

test("the original list is left as it was", () => {
  rankTopUp(products, 280, 2);
  assert.deepEqual(prices(products), [100, 300, 90, 1500, 280, 50]);
});
