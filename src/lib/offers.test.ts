import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignEventInput, campaignRates, isLive, isShopImage, offerHref, offerInput, orderBucket } from "./offers";

const NOW = Date.parse("2026-11-16T12:00:00Z");
const d = (iso: string) => new Date(iso);

test("an offer shows only while published and between its dates", () => {
  assert.equal(isLive({ isPublished: true, startsAt: null, endsAt: null }, NOW), true);
  assert.equal(isLive({ isPublished: false, startsAt: null, endsAt: null }, NOW), false);
  assert.equal(isLive({ isPublished: true, startsAt: d("2026-11-17T00:00:00Z"), endsAt: null }, NOW), false);
  assert.equal(isLive({ isPublished: true, startsAt: null, endsAt: d("2026-11-16T11:59:00Z") }, NOW), false);
  assert.equal(isLive({ isPublished: true, startsAt: d("2026-11-10T00:00:00Z"), endsAt: d("2026-11-18T00:00:00Z") }, NOW), true);
});

test("“shop now” goes to the offer page only when asked for and published", () => {
  assert.equal(offerHref({ link: "page" }, "qcy-t13", true), "/offers/qcy-t13");
  assert.equal(offerHref({ link: "page" }, "qcy-t13", false), "/products/qcy-t13");
  assert.equal(offerHref({ link: "product" }, "qcy-t13", true), "/products/qcy-t13");
});

test("only the shop's own photos are accepted", () => {
  assert.equal(isShopImage("https://res.cloudinary.com/x/image/upload/a.webp"), true);
  assert.equal(isShopImage("/categories/headphones.webp"), true);
  assert.equal(isShopImage("https://www.apple.com/airpods.jpg"), false);
  assert.equal(isShopImage("javascript:alert(1)"), false);
});

const form = { name: "عرض السماعات", productId: "p1", style: "dark", titleAr: "صوت نقي طول النهار", link: "product" };

test("offer form: dates are read in Moroccan time and the end must follow the start", () => {
  const ok = offerInput.parse({ ...form, startsAt: "2026-11-16T10:00", endsAt: "2026-11-18T23:59" });
  assert.equal(ok.endsAt?.toISOString(), "2026-11-18T23:59:00.000Z");
  assert.equal(ok.image, null);
  assert.equal(offerInput.safeParse({ ...form, startsAt: "2026-11-18T10:00", endsAt: "2026-11-16T10:00" }).success, false);
  assert.equal(offerInput.safeParse({ ...form, image: "https://example.com/beats.png" }).success, false);
  assert.equal(offerInput.safeParse({ ...form, style: "carousel" }).success, false);
});

test("order status → studio bucket; delivered is the success", () => {
  assert.deepEqual(["NEW", "CONFIRMED", "SHIPPING", "DELIVERED", "RETURNING", "RETURNED", "CANCELLED"].map(orderBucket), ["waiting", "confirmed", "confirmed", "delivered", "refused", "refused", "cancelled"]);
});

test("rates: no division by zero, one decimal", () => {
  assert.deepEqual(campaignRates({ clicks: 0, orders: 0, confirmed: 0, delivered: 0, refused: 0 }), { orderRate: null, confirmRate: null, deliveryRate: null, refusalRate: null });
  assert.deepEqual(campaignRates({ clicks: 300, orders: 9, confirmed: 7, delivered: 6, refused: 1 }), { orderRate: 3, confirmRate: 77.8, deliveryRate: 66.7, refusalRate: 11.1 });
});

test("click events: only the three known types and sources", () => {
  assert.equal(campaignEventInput.safeParse({ type: "hero_cta_click", source: "home", offerId: "o1" }).success, true);
  assert.equal(campaignEventInput.safeParse({ type: "page_view", source: "home" }).success, false);
  assert.equal(campaignEventInput.safeParse({ type: "whatsapp_click", source: "email" }).success, false);
});
