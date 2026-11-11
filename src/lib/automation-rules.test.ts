import assert from "node:assert/strict";
import { test } from "node:test";
import { RETRY_LIMIT, STUCK_MINUTES, stuckJobOutcome, templateValues, triggerStillValid, type ParamKey } from "./automation-rules";

const values: Record<ParamKey, string | null> = { name: "كريمة", number: "EB-ABC234", total: "230 درهم", products: "سماعة\nبطارية", city: "الدار البيضاء", address: "حي   السلام", tracking: null, review_link: "https://x.ma/review/1" };

test("a confirm reminder is dropped once the order is confirmed or cancelled", () => {
  assert.equal(triggerStillValid("order_created", "NEW"), true);
  assert.equal(triggerStillValid("order_created", "CONFIRMED"), false);
  assert.equal(triggerStillValid("order_created", "CANCELLED"), false);
});

test("delivery messages only go while the parcel is still out", () => {
  assert.equal(triggerStillValid("out_for_delivery", "SHIPPING"), true);
  assert.equal(triggerStillValid("out_for_delivery", "DELIVERED"), false);
  assert.equal(triggerStillValid("delivery_failed", "RETURNED"), false);
  assert.equal(triggerStillValid("order_delivered", "DELIVERED"), true);
  assert.equal(triggerStillValid("order_delivered", "RETURNED"), false);
});

test("an unknown trigger is never valid", () => {
  assert.equal(triggerStillValid("nope", "NEW"), false);
});

test("values follow the rule's order and are cleaned of line breaks", () => {
  assert.deepEqual(templateValues(["number", "products", "address"], values), ["EB-ABC234", "سماعة بطارية", "حي السلام"]);
});

test("a missing value or an unknown key holds the message back", () => {
  assert.equal(templateValues(["name", "tracking"], values), null);
  assert.equal(templateValues(["nope"], values), null);
});

test("a template with no parameters has an empty list", () => {
  assert.deepEqual(templateValues([], values), []);
});

// ── Jobs stuck in SENDING ──
const T = new Date("2026-11-11T12:00:00Z");
const ago = (min: number) => new Date(T.getTime() - min * 60_000);

test("a job taken less than 15 minutes ago is left alone, whatever its state", () => {
  assert.equal(stuckJobOutcome({ claimedAt: ago(14), sendStartedAt: null, dueAt: ago(60), attempts: 1 }, T, false), "wait");
  assert.equal(stuckJobOutcome({ claimedAt: ago(14), sendStartedAt: ago(14), dueAt: ago(60), attempts: 1 }, T, true), "wait");
  assert.equal(STUCK_MINUTES, 15);
});

test("the call to Meta never started: certain nothing went out, so it is sent again", () => {
  assert.equal(stuckJobOutcome({ claimedAt: ago(16), sendStartedAt: null, dueAt: ago(60), attempts: 1 }, T, false), "retry");
});

test("the call to Meta started and no message is recorded: a person decides, never an automatic resend", () => {
  assert.equal(stuckJobOutcome({ claimedAt: ago(20), sendStartedAt: ago(20), dueAt: ago(60), attempts: 1 }, T, false), "review");
});

test("the message is in the inbox: it went out, so it is marked sent", () => {
  assert.equal(stuckJobOutcome({ claimedAt: ago(20), sendStartedAt: ago(20), dueAt: ago(60), attempts: 1 }, T, true), "sent");
});

test("an old job with no record of when it was taken can't be proven unsent", () => {
  assert.equal(stuckJobOutcome({ claimedAt: null, sendStartedAt: null, dueAt: ago(60), attempts: 1 }, T, false), "review");
  assert.equal(stuckJobOutcome({ claimedAt: null, sendStartedAt: null, dueAt: ago(5), attempts: 1 }, T, false), "wait");
});

test("a job that keeps getting stuck before sending stops being retried", () => {
  assert.equal(stuckJobOutcome({ claimedAt: ago(16), sendStartedAt: null, dueAt: ago(60), attempts: RETRY_LIMIT }, T, false), "review");
});
