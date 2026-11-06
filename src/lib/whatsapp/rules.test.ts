import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { nextStatus, parseWebhook, verifySignature, windowOpen, WINDOW_MS } from "./rules";

const sign = (body: string, secret: string) => `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;

test("accepts only the exact body signed with the app secret", () => {
  const body = '{"a":"سلام"}';
  assert.equal(verifySignature(body, sign(body, "s3"), "s3"), true);
  assert.equal(verifySignature(`${body} `, sign(body, "s3"), "s3"), false);
  assert.equal(verifySignature(body, sign(body, "other"), "s3"), false);
});

test("refuses a missing or malformed signature without throwing", () => {
  assert.equal(verifySignature("x", null, "s"), false);
  assert.equal(verifySignature("x", "md5=abc", "s"), false);
  assert.equal(verifySignature("x", "sha256=zz", "s"), false);
  assert.equal(verifySignature("x", "sha256=abcd", "s"), false);
});

test("the 24-hour window closes exactly at 24 hours", () => {
  const now = Date.now();
  assert.equal(windowOpen(null, now), false);
  assert.equal(windowOpen(new Date(now - WINDOW_MS + 1000), now), true);
  assert.equal(windowOpen(new Date(now - WINDOW_MS), now), false);
});

const wrap = (value: unknown) => ({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value }] }] });

test("reads a text message with its sender's name", () => {
  const { messages } = parseWebhook(
    wrap({
      contacts: [{ wa_id: "212612345678", profile: { name: "Karima" } }],
      messages: [{ from: "212612345678", id: "wamid.A", timestamp: "1700000000", type: "text", text: { body: "بغيت سماعة" } }],
    }),
  );
  assert.deepEqual(messages, [{ wamid: "wamid.A", phone: "+212612345678", name: "Karima", type: "text", body: "بغيت سماعة", at: new Date(1700000000000) }]);
});

test("media shows a label and its caption, and unknown types do not break", () => {
  const { messages } = parseWebhook(
    wrap({
      messages: [
        { from: "1", id: "a", type: "image", image: { caption: "هادي" } },
        { from: "1", id: "b", type: "audio" },
        { from: "1", id: "c", type: "unsupported" },
        { from: "1", id: "d", type: "interactive", interactive: { button_reply: { title: "نعم" } } },
      ],
    }),
  );
  assert.deepEqual(messages.map((m) => m.body), ["[صورة] هادي", "[رسالة صوتية]", "[رسالة غير مدعومة]", "نعم"]);
});

test("reads delivery updates, including why one failed", () => {
  const { statuses } = parseWebhook(
    wrap({
      statuses: [
        { id: "x", status: "read" },
        { id: "y", status: "failed", errors: [{ code: 131026, message: "Undeliverable" }] },
      ],
    }),
  );
  assert.deepEqual(statuses, [
    { wamid: "x", status: "read", error: null },
    { wamid: "y", status: "failed", error: "131026 Undeliverable" },
  ]);
});

test("malformed payloads give nothing instead of throwing", () => {
  for (const bad of [null, undefined, 3, "x", {}, { entry: [{}] }, { entry: [{ changes: [{}] }] }, wrap({ messages: [{ type: "text" }], statuses: [{ status: "read" }] })]) {
    assert.deepEqual(parseWebhook(bad), { messages: [], statuses: [] });
  }
});

test("a late delivery update never overwrites a read one, and failure always shows", () => {
  assert.equal(nextStatus("sent", "delivered"), "delivered");
  assert.equal(nextStatus("read", "delivered"), "read");
  assert.equal(nextStatus("delivered", "failed"), "failed");
  assert.equal(nextStatus("failed", "read"), "failed");
  assert.equal(nextStatus(null, "sent"), "sent");
});
