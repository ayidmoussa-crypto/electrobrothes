import assert from "node:assert/strict";
import { test } from "node:test";
import { renderOrderEmail, type EmailOrder } from "./order-email";

const order: EmailOrder = {
  id: "ord_1",
  number: "EB-7KQ4ZP",
  customerName: '<script>alert("x")</script>',
  phone: "+212612345678",
  cityName: "الدار البيضاء",
  address: "Rue 12 & <b>Bloc</b>",
  notes: null,
  subtotal: 8147,
  shippingFee: 0,
  discount: 814,
  total: 7333,
  couponCode: "BIENVENUE10",
  riskScore: 40,
  riskFlags: ["duplicate_phone"],
  items: [{ nameAr: "سامسونج جالاكسي A55", variantLabel: "أزرق · 128GB", quantity: 2, unitPrice: 3999 }],
};

test("customer-typed text is escaped in the HTML email", () => {
  const { html } = renderOrderEmail(order, "https://shop.example");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("Rue 12 &amp; &lt;b&gt;Bloc&lt;/b&gt;"));
});

test("subject flags risky orders and shows the cash amount and city", () => {
  const { subject } = renderOrderEmail(order, "https://shop.example");
  assert.match(subject, /^⚠️ طلب جديد EB-7KQ4ZP/);
  assert.match(subject, /7\s333 د\.م\./u);
  assert.match(subject, /الدار البيضاء/);
  assert.doesNotMatch(renderOrderEmail({ ...order, riskScore: 0, riskFlags: [] }, "x").subject, /⚠️/);
});

test("both versions link to the order in the admin", () => {
  const { html, text } = renderOrderEmail(order, "https://shop.example");
  assert.ok(html.includes("https://shop.example/admin/orders/ord_1"));
  assert.ok(text.includes("https://shop.example/admin/orders/ord_1"));
  assert.ok(text.includes("06 12 34 56 78"));
});
