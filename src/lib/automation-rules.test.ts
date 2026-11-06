import assert from "node:assert/strict";
import { test } from "node:test";
import { templateValues, triggerStillValid, type ParamKey } from "./automation-rules";

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
