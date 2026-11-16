import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmationText, orderRequestText, whatsappLink } from "./order-whatsapp";

const order = { customerName: "Sara", number: "EB-TCELA6", total: 550, address: "Rue 1", cityName: "الدار البيضاء", prepaid: false };

test("the confirmation message names the order, the amount at the door and the address", () => {
  const t = confirmationText(order);
  assert.match(t, /EB-TCELA6/);
  assert.match(t, /550 درهم عند الاستلام/);
  assert.match(t, /Rue 1، الدار البيضاء/);
});

test("a prepaid order asks for no money", () => {
  const t = confirmationText({ ...order, prepaid: true });
  assert.doesNotMatch(t, /درهم/);
  assert.match(t, /المدفوع مسبقاً/);
});

test("the shopper's order request names the product and its price in dirhams", () => {
  assert.equal(orderRequestText("سماعة X", 349), "السلام عليكم، بغيت نطلب: سماعة X - 349 درهم");
});

test("the link opens WhatsApp on the customer's number with the text encoded", () => {
  assert.equal(whatsappLink("+212612345678", "a b"), "https://wa.me/212612345678?text=a%20b");
});
