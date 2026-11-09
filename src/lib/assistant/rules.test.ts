import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetMonth, comparableImage, costMicros, HAIKU, overBudget, replyScript, sameOperation, scrubInternalIds, SONNET, sniffImage, stockDelta, storeImageUrl, updateSignature } from "./rules";

test("the same product, colour and quantity count as the same operation", () => {
  const add = { kind: "STOCK_CHANGE", variant_id: "v1", mode: "add", quantity: 50 } as const;
  assert.equal(sameOperation(add, { ...add }), true);
  assert.equal(sameOperation(add, { ...add, quantity: 51 }), false);
  assert.equal(sameOperation(add, { ...add, variant_id: "v2" }), false);
  assert.equal(sameOperation(add, { ...add, mode: "remove" }), false);
});

test("a repeated draft is recognised whatever the order of its colours", () => {
  const draft = { kind: "DRAFT_PRODUCT" as const, name_en: "Anker Q99", colors: [{ color_ar: "أسود", quantity: 7 }, { color_ar: "أبيض", quantity: 2 }] };
  assert.equal(sameOperation(draft, { ...draft, name_en: " anker q99 ", colors: [draft.colors[1], draft.colors[0]] }), true);
  assert.equal(sameOperation(draft, { ...draft, colors: [{ color_ar: "أسود", quantity: 8 }] }), false);
});

test("a repeated product edit is recognised whatever the order of its lists; a different price is not", () => {
  const base = {
    name_ar: null,
    name_en: null,
    description_ar: null,
    description_en: null,
    unit_cost_mad: null,
    prices: [
      { variant_id: "v1", price_mad: 250, compare_at_mad: 300 },
      { variant_id: "v2", price_mad: 250, compare_at_mad: null },
    ],
    new_colors: [
      { color_en: "Blue", quantity: 10 },
      { color_en: "Red", quantity: 3 },
    ],
  };
  const a = { kind: "PRODUCT_UPDATE" as const, product_id: "p1", signature: updateSignature(base) };
  const reordered = updateSignature({ ...base, prices: [base.prices[1], base.prices[0]], new_colors: [{ color_en: " blue ", quantity: 10 }, base.new_colors[1]] });
  assert.equal(sameOperation(a, { ...a, signature: reordered }), true);
  assert.equal(sameOperation(a, { ...a, product_id: "p2" }), false);
  assert.equal(sameOperation(a, { ...a, signature: updateSignature({ ...base, prices: [{ variant_id: "v1", price_mad: 240, compare_at_mad: 300 }, base.prices[1]] }) }), false);
});

test("the reply follows the letters the admin wrote in", () => {
  assert.equal(replyScript("جبت من Sony WH-1000XM5 20 كحل"), "arabic");
  assert.equal(replyScript("jbt 20 Sony k7al"), "latin");
  assert.equal(replyScript("j'ai reçu 10 casques"), "latin");
  assert.equal(replyScript("20"), "arabic");
});

test("internal ids never reach the screen, ordinary numbers do", () => {
  assert.equal(scrubInternalIds("اخترت سوني (product_id: cmhfk2x9a0001abcd1234efgh)"), "اخترت سوني");
  assert.equal(scrubInternalIds("الموديل cmhfk2x9a0001abcd1234efgh بقاو منو 20"), "الموديل بقاو منو 20");
  assert.equal(scrubInternalIds("variant_id=abc-123 كحل"), "كحل");
  assert.equal(scrubInternalIds("سوني WH-1000XM5 بقاو منو 7"), "سوني WH-1000XM5 بقاو منو 7");
});

test("API cost follows each model's price", () => {
  assert.equal(costMicros(HAIKU, { input: 1_000_000, output: 0 }), 100_000);
  assert.equal(costMicros(HAIKU, { input: 0, output: 1_000_000 }), 500_000);
  assert.equal(costMicros(SONNET, { input: 1000, output: 1000 }), 12_000);
});

test("cache tokens are priced, and an unknown model is never counted as cheap", () => {
  assert.equal(costMicros(SONNET, { input: 0, output: 0, cacheRead: 1000, cacheWrite: 1000 }), 2700);
  assert.ok(costMicros("another-model", { input: 1000, output: 1000 }) > costMicros(SONNET, { input: 1000, output: 1000 }));
});

test("the ceiling blocks at the limit, and 0 turns the assistant off", () => {
  assert.equal(overBudget(4_999_999, 500), false);
  assert.equal(overBudget(5_000_000, 500), true);
  assert.equal(overBudget(0, 0), true);
});

test("the budget month changes at midnight in Morocco (GMT since 2026-09-20)", () => {
  assert.equal(budgetMonth(new Date("2026-10-31T23:59:00Z")), "2026-10");
  assert.equal(budgetMonth(new Date("2026-11-01T00:00:00Z")), "2026-11");
});

test("stock requests become the right move", () => {
  assert.equal(stockDelta("add", 20, 5), 20);
  assert.equal(stockDelta("remove", 3, 5), -3);
  assert.equal(stockDelta("set", 0, 5), -5);
  assert.equal(stockDelta("set", 8, 5), 3);
});

test("an image's type comes from its bytes, not its label", () => {
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString("base64")), "image/jpeg");
  assert.equal(sniffImage(Buffer.from("\x89PNG\r\n\x1a\n", "latin1").toString("base64")), "image/png");
  assert.equal(sniffImage(Buffer.from("RIFF0000WEBPVP8 ", "latin1").toString("base64")), "image/webp");
  assert.equal(sniffImage(Buffer.from("<svg xmlns=").toString("base64")), null);
});

test("SVG placeholders cannot be compared with a photo", () => {
  assert.equal(comparableImage("image/svg+xml"), null);
  assert.equal(comparableImage("image/jpeg; charset=binary"), "image/jpeg");
});

test("store images are fetched only from this site or Cloudinary", () => {
  assert.equal(storeImageUrl("/a.jpg", "http://localhost:3000"), "http://localhost:3000/a.jpg");
  assert.equal(storeImageUrl("https://res.cloudinary.com/x/a.jpg", "http://localhost:3000"), "https://res.cloudinary.com/x/a.jpg");
  assert.equal(storeImageUrl("https://evil.example/a.jpg", "http://localhost:3000"), null);
  assert.equal(storeImageUrl("//evil.example/a.jpg", "http://localhost:3000"), null);
  assert.equal(storeImageUrl("http://169.254.169.254/a.jpg", "http://localhost:3000"), null);
});
