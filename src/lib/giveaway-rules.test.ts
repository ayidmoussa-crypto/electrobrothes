import assert from "node:assert/strict";
import { test } from "node:test";
import { drawReel, entryInput, giveawayPhase, giveawaySlug, maskPhone, pickWinner, publicName } from "./giveaway-rules";

test("phase follows the draw time and the draw itself", () => {
  const drawAt = new Date("2026-12-01T20:00:00Z");
  assert.equal(giveawayPhase({ drawAt, drawnAt: null }, drawAt.getTime() - 1), "open");
  assert.equal(giveawayPhase({ drawAt, drawnAt: null }, drawAt.getTime()), "closed");
  // Drawn early during a live: closed for good, whatever the clock says.
  assert.equal(giveawayPhase({ drawAt, drawnAt: new Date("2026-11-30T20:00:00Z") }, drawAt.getTime() - 1e6), "drawn");
});

test("entry form: Moroccan phone, real names, rules accepted", () => {
  const ok = entryInput.safeParse({ firstName: "  Ayoub ", lastName: "Aït-Ali", phone: "06 12 34 56 78", rules: "on" });
  assert.ok(ok.success);
  assert.deepEqual(ok.data, { firstName: "Ayoub", lastName: "Aït-Ali", phone: "+212612345678", rules: "on", marketing: false });
  assert.ok(entryInput.safeParse({ firstName: "عبد الله", lastName: "العلوي", phone: "+212712345678", rules: "on", marketing: "on" }).success);

  const bad = (v: Record<string, string>) => {
    const r = entryInput.safeParse({ firstName: "Sara", lastName: "Benali", phone: "0612345678", rules: "on", ...v });
    return r.success ? null : r.error.issues.map((i) => `${String(i.path[0])}:${i.message}`);
  };
  assert.deepEqual(bad({ phone: "+33612345678" }), ["phone:phone"]);
  assert.deepEqual(bad({ firstName: "S" }), ["firstName:short"]);
  assert.deepEqual(bad({ lastName: "B3n" }), ["lastName:letters"]);
  assert.deepEqual(bad({ rules: "" }), ["rules:rules"]);
});

test("public name and masked phone show only what the live needs", () => {
  assert.equal(publicName("Fatima Zahra", "el idrissi"), "Fatima E.");
  assert.equal(publicName("يوسف", "بناني"), "يوسف ب.");
  assert.equal(maskPhone("+212612345678"), "06 •• •• •• 78");
  assert.equal(maskPhone("+212712345690"), "07 •• •• •• 90");
});

test("winner pick is uniform and refuses a broken random source", () => {
  assert.equal(pickWinner([], () => 0), null);
  assert.equal(pickWinner(["a", "b", "c"], () => 2), "c");
  assert.throws(() => pickWinner(["a"], () => 1));
  const counts = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 3000; i++) counts[pickWinner(["a", "b", "c"] as const, (n) => i % n)!]++;
  assert.deepEqual(counts, { a: 1000, b: 1000, c: 1000 });
});

test("reel ends on the winner and never repeats a name back to back", () => {
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const reel = drawReel(["A", "B", "C", "W"], "W", 30, rnd);
  assert.equal(reel.length, 30);
  assert.equal(reel.at(-1), "W");
  assert.ok(!reel.slice(0, -1).includes("W"));
  for (let i = 1; i < reel.length - 1; i++) assert.notEqual(reel[i], reel[i - 1]);
  assert.deepEqual(drawReel(["W"], "W"), ["W"]);
});

test("slug carries the month", () => {
  assert.equal(giveawaySlug("Win the Soundcore Q45!", new Date("2026-12-01T20:00:00Z")), "win-the-soundcore-q45-2026-12");
  assert.equal(giveawaySlug("سحب", new Date("2027-01-05T00:00:00Z")), "giveaway-2027-01");
});
