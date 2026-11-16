import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultLandingContent, landingContentSchema, normalizeSections, publishProblems, readPublished, words } from "./landing";

test("sections: every middle section once, saved order kept, unknown and repeated keys dropped, missing ones added", () => {
  const s = normalizeSections([{ key: "warranty", hidden: true }, { key: "hero" }, { key: "warranty" }, { key: "features" }, { key: "order", hidden: true }]);
  assert.deepEqual(
    s.map((x) => x.key),
    ["warranty", "features", "comparison", "reviews"],
  );
  assert.equal(s[0].hidden, true);
  assert.equal(s[2].hidden, false);
  assert.deepEqual(normalizeSections("broken").map((x) => x.key), ["features", "comparison", "warranty", "reviews"]);
});

const product = {
  nameAr: "سماعة لاسلكية X200 بخاصية إلغاء الضوضاء وبطارية طويلة جدا جدا",
  descriptionAr: "سماعة خفيفة ومريحة للاستعمال اليومي. صوت نقي.",
  highlightsAr: ["إلغاء الضوضاء: يعزل الضجيج في الطريق", "منفذ USB-C للشحن"],
  specs: [
    { key: "battery", valueAr: "30 ساعة" },
    { key: "connectivity", valueAr: "بلوتوث 5.3" },
  ],
  faqs: [{ questionAr: "هل الدفع عند الاستلام؟", answerAr: "نعم." }],
};

test("default copy comes only from the product's own words, within the limits", () => {
  const c = defaultLandingContent(product);
  assert.equal(words(c.headline), 8);
  assert.equal(c.subline, "سماعة خفيفة ومريحة للاستعمال اليومي.");
  assert.deepEqual(c.features[0], { title: "إلغاء الضوضاء", text: "يعزل الضجيج في الطريق", icon: "sparkles" });
  // A hyphen inside a word is not a "title – text" separator; a short highlight is its own title and text.
  assert.equal(c.features[1].title, "منفذ USB-C للشحن");
  // A longer one without a separator is split, so title and text do not repeat each other.
  const split = defaultLandingContent({ ...product, highlightsAr: ["شريط لمس على العلبة للتحكم في الموسيقى"] }).features[0];
  assert.deepEqual([split.title, split.text], ["شريط لمس على", "العلبة للتحكم في الموسيقى"]);
  assert.deepEqual(c.features[2], { title: "البطارية", text: "30 ساعة", icon: "battery" });
  assert.equal(c.features.length, 4);
  assert.deepEqual(c.faq, [{ q: "هل الدفع عند الاستلام؟", a: "نعم." }]);
  assert.ok(landingContentSchema.safeParse(c).success);
});

test("default copy never pads: a product with little data gets fewer features, and cannot be published as is", () => {
  const c = defaultLandingContent({ nameAr: "شاحن", descriptionAr: "", highlightsAr: [], specs: [], faqs: [] });
  assert.equal(c.features.length, 0);
  assert.ok(publishProblems(c).length >= 2);
});

test("publishing needs a headline, a subline and 3 complete features within the word limits", () => {
  const ok = defaultLandingContent(product);
  assert.deepEqual(publishProblems(ok), []);
  const long = { ...ok, headline: "واحد اثنان ثلاثة أربعة خمسة ستة سبعة ثمانية تسعة" };
  assert.equal(publishProblems(long).length, 1);
  const half = { ...ok, features: [...ok.features.slice(0, 2), { title: "ميزة", text: "", icon: "zap" as const }] };
  assert.ok(publishProblems(half).some((p) => p.includes("3")));
});

test("a broken published value is read as not published", () => {
  assert.equal(readPublished(null), null);
  assert.equal(readPublished({ template: "apple", sections: [], content: {} }), null);
  const p = readPublished({ template: "editorial", sections: [{ key: "reviews", hidden: true }], content: defaultLandingContent(product) });
  assert.equal(p?.template, "editorial");
  assert.equal(p?.sections[0].key, "reviews");
});
