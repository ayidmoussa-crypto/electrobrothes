import assert from "node:assert/strict";
import { test } from "node:test";
import { channelOfManualSource, decodeTouch, detectTouch, encodeTouch, nextTouch, trackingLinks } from "./attribution";

const own = "electrobrothers.ma";
const visit = (path: string, referrer: string | null = null) => detectTouch(new URL(`https://electrobrothers.ma${path}`), referrer, own);

test("tagged links win over everything", () => {
  assert.deepEqual(visit("/?utm_source=instagram&utm_medium=bio"), { channel: "INSTAGRAM", detail: null });
  assert.deepEqual(visit("/?utm_source=tiktok&utm_medium=bio", "https://www.google.com/"), { channel: "TIKTOK", detail: null });
  assert.deepEqual(visit("/?utm_source=facebook&utm_medium=paid&utm_campaign=Black Friday"), { channel: "META_ADS", detail: "black-friday" });
  assert.deepEqual(visit("/?utm_source=ig&utm_medium=cpc"), { channel: "META_ADS", detail: null });
  assert.deepEqual(visit("/?utm_source=tiktok&utm_medium=paid"), { channel: "TIKTOK_ADS", detail: null });
  assert.deepEqual(visit("/?utm_source=whatsapp&utm_medium=status"), { channel: "WHATSAPP", detail: null });
  assert.deepEqual(visit("/?utm_source=Hespress"), { channel: "REFERRAL", detail: "hespress" });
});

test("ad click ids name the ad network", () => {
  assert.equal(visit("/?gclid=abc")?.channel, "GOOGLE_ADS");
  assert.equal(visit("/?ttclid=abc")?.channel, "TIKTOK_ADS");
});

test("the page the visitor came from", () => {
  assert.deepEqual(visit("/", "https://www.google.co.ma/"), { channel: "SEO", detail: "google" });
  assert.deepEqual(visit("/", "https://www.bing.com/search?q=x"), { channel: "SEO", detail: "bing" });
  assert.equal(visit("/", "https://l.instagram.com/?u=x")?.channel, "INSTAGRAM");
  assert.equal(visit("/", "https://lm.facebook.com/")?.channel, "FACEBOOK");
  assert.equal(visit("/", "https://www.tiktok.com/")?.channel, "TIKTOK");
  assert.equal(visit("/", "https://youtu.be/x")?.channel, "YOUTUBE");
  assert.equal(visit("/", "https://mail.google.com/")?.channel, "EMAIL");
  assert.deepEqual(visit("/", "https://forum.example.org/t/1"), { channel: "REFERRAL", detail: "forum.example.org" });
});

test("Meta's fbclid without a referrer is Facebook, with Instagram's referrer it is Instagram", () => {
  assert.equal(visit("/?fbclid=x")?.channel, "FACEBOOK");
  assert.equal(visit("/?fbclid=x", "https://l.instagram.com/")?.channel, "INSTAGRAM");
});

test("moving inside the shop says nothing; no clue at all is direct", () => {
  assert.equal(visit("/products/x", "https://electrobrothers.ma/"), null);
  assert.equal(visit("/", "https://www.electrobrothers.ma/cart"), null);
  assert.deepEqual(visit("/"), { channel: "DIRECT", detail: null });
  assert.deepEqual(visit("/", "not a url"), { channel: "DIRECT", detail: null });
});

test("the cookie keeps the latest known channel; a direct visit never replaces it", () => {
  const ig = { channel: "INSTAGRAM" as const, detail: null };
  const direct = { channel: "DIRECT" as const, detail: null };
  assert.deepEqual(nextTouch(null, direct), direct);
  assert.equal(nextTouch(ig, direct), null);
  assert.equal(nextTouch(ig, ig), null);
  assert.equal(nextTouch(ig, null), null);
  assert.deepEqual(nextTouch(ig, { channel: "SEO", detail: "google" }), { channel: "SEO", detail: "google" });
  assert.deepEqual(nextTouch(direct, ig), ig);
});

test("cookie round trip refuses anything unknown", () => {
  assert.deepEqual(decodeTouch(encodeTouch({ channel: "META_ADS", detail: "promo" })), { channel: "META_ADS", detail: "promo" });
  assert.deepEqual(decodeTouch("SEO"), { channel: "SEO", detail: null });
  assert.equal(decodeTouch("HACK:x"), null);
  assert.equal(decodeTouch(undefined), null);
  assert.deepEqual(decodeTouch("REFERRAL:<script>"), { channel: "REFERRAL", detail: "script" });
});

test("manual orders take the app of the conversation", () => {
  assert.equal(channelOfManualSource("INSTAGRAM"), "INSTAGRAM");
  assert.equal(channelOfManualSource("PHONE"), "PHONE");
  assert.equal(channelOfManualSource("OTHER"), "OTHER");
});

test("ready links are read back as their own channel", () => {
  for (const l of trackingLinks("https://electrobrothers.ma")) {
    const t = detectTouch(new URL(l.url), null, own);
    assert.notEqual(t?.channel, "DIRECT");
    assert.notEqual(t?.channel, "REFERRAL");
  }
});
