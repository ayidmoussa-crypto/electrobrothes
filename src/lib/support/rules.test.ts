import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewToken } from "@/lib/reviews/rules";
import { readSupportToken, rewardCode, rewardExpiry, supportStats, supportToken, supportWhatsappMessage, warrantyState, type TicketRow } from "./rules";

const SECRET = "a-test-secret-of-at-least-32-characters";

test("a support link opens only for its own order, and is not the review link", () => {
  const token = supportToken("order1", SECRET);
  assert.equal(readSupportToken(token, SECRET), "order1");
  assert.equal(readSupportToken(`order2-${token.split("-").slice(1).join("-")}`, SECRET), null);
  assert.equal(readSupportToken(token, "another-secret-of-at-least-32-characters"), null);
  assert.equal(readSupportToken(reviewToken("order1", SECRET), SECRET), null);
  assert.equal(readSupportToken("order1", SECRET), null);
  assert.equal(readSupportToken("-abc", SECRET), null);
  assert.ok(!supportToken("cmvw3zucg0049fwvefhdbpnfq", SECRET).includes("."));
});

test("the warranty runs from delivery for the product's months", () => {
  const delivered = new Date("2026-01-15T10:00:00Z");
  assert.equal(warrantyState(delivered, 12, new Date("2026-12-01")).covered, true);
  assert.equal(warrantyState(delivered, 6, new Date("2026-08-01")).covered, false);
  assert.equal(warrantyState(delivered, 0, new Date("2026-01-16")).covered, false);
  assert.equal(warrantyState(delivered, 6).endsAt.toISOString(), "2026-07-15T10:00:00.000Z");
});

test("figures split who solved what, per product and per kind of problem", () => {
  const row = (status: TicketRow["status"], o: Partial<TicketRow> = {}): TicketRow => ({ status, solvedByAi: false, verdict: null, category: "battery", productId: "p1", productName: "Buds", ...o });
  const s = supportStats([
    row("SOLVED", { solvedByAi: true }),
    row("SOLVED", { solvedByAi: true, category: "connection" }),
    row("SOLVED", { productId: "p2", productName: "Watch" }),
    row("REPLACED"),
    row("UNSOLVED", { category: null }),
    // Closed by the owner as the customer's doing: counted apart from "not solved".
    row("UNSOLVED", { verdict: "misuse", category: "charging" }),
    // Only the AI's guess so far: still waiting for the owner.
    row("ESCALATED", { verdict: "misuse" }),
    row("OPEN", { category: "nonsense" }),
  ]);
  assert.deepEqual(s.totals, { total: 8, solvedByAi: 2, solvedByOwner: 1, replaced: 1, customerCause: 1, unsolved: 1, waiting: 1, open: 1 });
  // 2 of the 6 closed ones.
  assert.equal(s.aiRate, 33);
  assert.equal(s.products[0].name, "Buds");
  assert.equal(s.products[0].total, 7);
  assert.equal(s.products[0].customerCause, 1);
  assert.equal(s.products[0].replaced, 1);
  assert.equal(s.categories[0].key, "battery");
  // Unknown or missing kinds count as "other".
  assert.equal(s.categories.find((c) => c.key === "other")?.total, 2);
  assert.equal(supportStats([]).aiRate, null);
});

test("the thank-you code is readable and lasts to the end of its last day", () => {
  let i = 0;
  const code = rewardCode(() => i++ % 32);
  assert.match(code, /^MERCI-[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(rewardExpiry(30, new Date("2026-11-19T10:00:00Z")).toISOString(), "2026-12-19T23:59:59.000Z");
});

test("the WhatsApp message greets by first name and carries the link", () => {
  const text = supportWhatsappMessage("  Salma Bennani ", "https://example.com/support/x-y");
  assert.match(text, /Salma،/);
  assert.ok(!text.includes("Bennani"));
  assert.ok(text.endsWith("https://example.com/support/x-y"));
});
