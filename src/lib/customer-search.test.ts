import assert from "node:assert/strict";
import { test } from "node:test";
import { customerSearchTerms, initials } from "./customer-search";

test("a phone typed any way finds the same buyer", () => {
  for (const typed of ["06 63 27 25 81", "0663272581", "+212663272581", "00212 663 272 581"]) {
    assert.equal(customerSearchTerms(typed).digits, "663272581", typed);
  }
  assert.equal(customerSearchTerms("ayoub").digits, "");
  assert.equal(customerSearchTerms("06").digits, "");
  assert.equal(customerSearchTerms("  Ayoub   Idmoussa ").text, "Ayoub Idmoussa");
});

test("two letters for the badge, Arabic too", () => {
  assert.equal(initials("Ayoub Idmoussa"), "AI");
  assert.equal(initials("souad"), "SO");
  assert.equal(initials("محمد محمد"), "مم");
  assert.equal(initials("  "), "?");
});
