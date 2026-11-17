import assert from "node:assert/strict";
import { test } from "node:test";
import { costMicros, SONNET } from "@/lib/assistant/rules";
import { externalRatingInput, formatCount, formatRating, isNegativeReview, isStaleRating, normalizeUrl, publicAuthorName, readReviewToken, reviewInput, reviewToken, reviewWhatsappMessage, urlsInText } from "./rules";
import { awaitsReviewAsk, REVIEW_ASK_DAYS, whatsappKind } from "./ask";

const SECRET = "a-test-secret-of-at-least-32-characters";

test("a review link opens only for its own order", () => {
  const token = reviewToken("order1", SECRET);
  assert.equal(readReviewToken(token, SECRET), "order1");
  assert.equal(readReviewToken(`order2-${token.split("-").slice(1).join("-")}`, SECRET), null);
  assert.equal(readReviewToken(token, "another-secret-of-at-least-32-characters"), null);
  assert.equal(readReviewToken("order1", SECRET), null);
  assert.equal(readReviewToken("order1-", SECRET), null);
  assert.equal(readReviewToken("-abc", SECRET), null);
});

test("a link has no dot, or the language router would treat it as a file", () => {
  assert.ok(!reviewToken("cmvw3zucg0049fwvefhdbpnfq", SECRET).includes("."));
});

test("one or two stars warn the owner", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(isNegativeReview), [true, true, false, false, false]);
});

test("review input limits", () => {
  assert.equal(reviewInput.safeParse({ rating: "5", comment: "مزيان بزاف" }).success, true);
  for (const bad of [{ rating: 0, comment: "مزيان" }, { rating: 6, comment: "مزيان" }, { rating: 2.5, comment: "مزيان" }, { rating: 5, comment: " a " }, { rating: 5, comment: "a".repeat(1001) }]) {
    assert.equal(reviewInput.safeParse(bad).success, false);
  }
});

test("only the first name is public", () => {
  assert.equal(publicAuthorName("  أيوب ادموسى "), "أيوب");
});

test("the WhatsApp message has the link, the product and no full name", () => {
  const m = reviewWhatsappMessage("أيوب ادموسى", ["سماعات QCY T13 Pro"], "https://shop/review/x");
  assert.ok(m.includes("https://shop/review/x") && m.includes("سماعات QCY T13 Pro") && m.includes("أيوب") && !m.includes("ادموسى"));
  assert.equal(m.trim().split("\n").at(-1), "https://shop/review/x");
});

test("the review message names the first product of several, or the order when none", () => {
  assert.ok(reviewWhatsappMessage("Sara", ["شاحن", "كابل"], "L").includes("شاحن وباقي المنتجات"));
  assert.ok(reviewWhatsappMessage("Sara", [" "], "L").includes("عجباتك طلبك"));
});

test("the green button asks for a review only on delivered orders", () => {
  assert.equal(whatsappKind("DELIVERED"), "review");
  for (const s of ["NEW", "CONFIRMED", "SHIPPING", "RETURNING", "RETURNED", "CANCELLED"]) assert.equal(whatsappKind(s), "confirm");
});

test("a delivered order awaits its review request until asked, reviewed or 30 days old", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  const base = { status: "DELIVERED", deliveredAt: new Date("2026-11-15T12:00:00Z"), reviewAskedAt: null, reviewed: false };
  assert.equal(awaitsReviewAsk(base, now), true);
  assert.equal(awaitsReviewAsk({ ...base, reviewAskedAt: now }, now), false);
  assert.equal(awaitsReviewAsk({ ...base, reviewed: true }, now), false);
  assert.equal(awaitsReviewAsk({ ...base, status: "SHIPPING" }, now), false);
  assert.equal(awaitsReviewAsk({ ...base, deliveredAt: null }, now), false);
  assert.equal(awaitsReviewAsk({ ...base, deliveredAt: new Date(now.getTime() - REVIEW_ASK_DAYS * 86_400_000) }, now), true);
  assert.equal(awaitsReviewAsk({ ...base, deliveredAt: new Date(now.getTime() - REVIEW_ASK_DAYS * 86_400_000 - 1) }, now), false);
});

test("a rating is stale only after 3 full months", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  assert.equal(isStaleRating(new Date("2026-08-03T12:00:00Z"), now), false);
  assert.equal(isStaleRating(new Date("2026-08-01T12:00:00Z"), now), true);
});

test("ratings read as the owner asked", () => {
  assert.equal(formatRating(4.6, 5), "4.6");
  assert.equal(formatRating(4, 5), "4.0");
  assert.equal(formatRating(8.4, 10), "8.4/10");
  assert.equal(formatCount(12345), "12,345");
});

const external = { source: "Amazon", url: "https://amazon.com/dp/X", rating: 4.6, ratingMax: 5, ratingCount: "", summaryAr: "", summaryEn: null };

test("an external rating must be https, on a known scale, and within it", () => {
  const ok = externalRatingInput.parse(external);
  assert.equal(ok.ratingCount, null);
  assert.equal(ok.summaryAr, null);
  for (const bad of [{ url: "http://amazon.com" }, { url: "javascript:alert(1)" }, { url: "not a url" }, { rating: 5.1 }, { ratingMax: 7 }, { source: "" }]) {
    assert.equal(externalRatingInput.safeParse({ ...external, ...bad }).success, false, JSON.stringify(bad));
  }
});

test("the same page matches despite tracking and a trailing slash", () => {
  assert.equal(normalizeUrl("https://a.com/p/?utm_source=x&id=1#top"), normalizeUrl("https://a.com/p?id=1"));
  assert.notEqual(normalizeUrl("https://a.com/p?id=1"), normalizeUrl("https://a.com/p?id=2"));
});

test("addresses are collected from result text", () => {
  assert.deepEqual(urlsInText('{"url":"https://a.com/x/","t":"see https://b.org/y."}'), ["https://a.com/x", "https://b.org/y."]);
});

test("each web search is billed", () => {
  assert.equal(costMicros(SONNET, { input: 0, output: 0, webSearches: 3 }), 30_000);
});
