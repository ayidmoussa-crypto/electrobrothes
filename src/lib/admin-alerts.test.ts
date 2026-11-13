import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAlerts, LATE_CALL_HOURS, type AlertCounts } from "./admin-alerts";

const tr = (ar: string) => ar;
const calm: AlertCounts = {
  newOrders: 0,
  oldestNewHours: null,
  readyToShip: 0,
  outOfStock: 0,
  lowStock: 0,
  stockList: [],
  unreadMessages: 0,
  unreadChats: 0,
  whatsappConnected: true,
  pendingReviews: 0,
  negativeReviews: 0,
  externalPending: 0,
  variantsWithoutCost: 0,
  emailReady: true,
};

test("nothing to do: no groups, so the bell stays quiet", () => {
  assert.deepEqual(buildAlerts(calm, "OWNER", tr), []);
});

test("an order waiting a day for a call turns red; most urgent first", () => {
  const groups = buildAlerts({ ...calm, newOrders: 3, oldestNewHours: LATE_CALL_HOURS, readyToShip: 2 }, "OWNER", tr);
  assert.deepEqual(groups.map((g) => g.id), ["orders"]);
  assert.deepEqual(groups[0].items.map((i) => [i.id, i.tone]), [["new-orders", "danger"], ["ready", "info"]]);
  assert.equal(buildAlerts({ ...calm, newOrders: 1, oldestNewHours: 2 }, "OWNER", tr)[0].items[0].tone, "warning");
});

test("negative reviews are not counted twice with the others waiting", () => {
  const [reviews] = buildAlerts({ ...calm, pendingReviews: 5, negativeReviews: 2 }, "OWNER", tr);
  assert.deepEqual(reviews.items.map((i) => [i.id, i.title]), [["negative", "2 تقييم سلبي كيتسنى"], ["pending", "3 تقييم كيتسنى الموافقة"]]);
});

test("stock: each named colour opens its product, empty ones first, the rest summed up", () => {
  const list = [
    { id: "v1", productId: "p1", name: "QCY · أسود", left: 2 },
    { id: "v2", productId: "p2", name: "Anker · أبيض", left: 0 },
  ];
  const [stock] = buildAlerts({ ...calm, outOfStock: 1, lowStock: 4, stockList: list }, "OWNER", tr);
  assert.deepEqual(
    stock.items.map((i) => [i.id, i.tone, i.href]),
    [
      ["stock-v2", "danger", "/admin/products/p2"],
      ["stock-v1", "warning", "/admin/products/p1"],
      ["stock-more", "info", "/admin/products"],
    ],
  );
  assert.equal(stock.items.at(-1)!.title, "+3 لون آخر قرب يسالي");
});

test("the confirmation team sees orders, messages and WhatsApp only", () => {
  const busy: AlertCounts = { ...calm, newOrders: 1, unreadMessages: 4, unreadChats: 2, outOfStock: 1, negativeReviews: 1, pendingReviews: 1, variantsWithoutCost: 3, whatsappConnected: false, emailReady: false };
  assert.deepEqual(buildAlerts(busy, "AGENT", tr).map((g) => g.id), ["orders", "messages", "system"]);
  assert.deepEqual(buildAlerts(busy, "AGENT", tr).at(-1)!.items.map((i) => i.id), ["whatsapp"]);
  assert.deepEqual(buildAlerts(busy, "OWNER", tr).map((g) => g.id), ["orders", "messages", "stock", "reviews", "finance", "system"]);
});
