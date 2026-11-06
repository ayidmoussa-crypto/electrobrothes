import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSubscriberEmail } from "./subscriber-email";

test("the same address is stored once, however it was typed", () => {
  assert.equal(normalizeSubscriberEmail("  Ali@Example.COM "), "ali@example.com");
});

test("anything that is not an email is refused", () => {
  for (const bad of ["", "ali", "ali@", "@example.com", "a b@example.com", null, undefined, 42, `${"a".repeat(250)}@example.com`]) {
    assert.equal(normalizeSubscriberEmail(bad), null, String(bad));
  }
});
