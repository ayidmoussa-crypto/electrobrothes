import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMoroccanPhone } from "./phone";

test("pasted numbers: Arabic digits, hidden marks and odd spaces are accepted", () => {
  assert.equal(normalizeMoroccanPhone("\u200E0604264868\u200F"), "+212604264868");
  assert.equal(normalizeMoroccanPhone("٠٦٠٤٢٦٤٨٦٨"), "+212604264868");
  assert.equal(normalizeMoroccanPhone("+212 604 264 868"), "+212604264868");
  assert.equal(normalizeMoroccanPhone("0604264868 / 0612345678"), null);
  assert.equal(normalizeMoroccanPhone("123"), null);
});
