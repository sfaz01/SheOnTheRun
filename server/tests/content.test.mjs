/* Phase 1 end-to-end: editing drafts, validation, conflicts, publishing real files,
   history/restore/discard, and inviting/removing admins.
     node --test server/tests/content.test.mjs */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { startServer, client, enrol } from "./helpers.mjs";

const TOKEN = "content-test-token-0123456789";
let srv, owner;

function liveData(file, global) {
  const box = { window: {} };
  vm.runInNewContext(readFileSync(join(srv.site, "data", file), "utf8"), box);
  return JSON.parse(JSON.stringify(box.window[global]));
}
const tee = (doc) => doc.categories[0].items.find((p) => p.id === "sotr-tee");

before(async () => {
  srv = await startServer({ port: 8194, setupToken: TOKEN });
  owner = client(srv.base);
  await owner.state();
  const r = await owner.call("POST", "/api/auth/setup", { token: TOKEN, email: "owner@example.com", password: "three purple running shoes" });
  assert.equal(r.status, 200);
  await enrol(owner);
});
after(() => srv?.stop());

test("content needs a signed-in admin", async () => {
  const anon = client(srv.base);
  await anon.state();
  assert.equal((await anon.call("GET", "/api/admin/content/shop")).status, 401);
  assert.equal((await anon.call("GET", "/api/admin/schema")).status, 401);
});

test("first use imports the website's content; nothing is waiting to publish", async () => {
  const schema = await owner.call("GET", "/api/admin/schema");
  assert.equal(schema.status, 200);
  assert.deepEqual(Object.keys(schema.json.areas), ["shop", "runs", "offer", "testimonials", "settings"]);
  assert.ok(schema.json.images.length > 50, "image list for the photo picker");

  const status = await owner.call("GET", "/api/admin/status");
  assert.ok(Object.values(status.json.changed).every((v) => v === false), JSON.stringify(status.json.changed));
  assert.equal(status.json.last_publish.note, "Imported from the website");

  const shop = await owner.call("GET", "/api/admin/content/shop");
  assert.equal(shop.json.rev, 1);
  assert.equal(tee(shop.json.doc).ar.name, "قميص SheOnTheRun");
});

test("invalid input is refused with messages pointing at the exact fields", async () => {
  const shop = (await owner.call("GET", "/api/admin/content/shop")).json;
  const doc = structuredClone(shop.doc);
  tee(doc).price = "abc";
  doc.categories[0].items[1].name = "";
  doc.categories[0].items[2].id = "sotr-tee"; // duplicate reference
  const r = await owner.call("PUT", "/api/admin/content/shop", { doc, rev: shop.rev });
  assert.equal(r.status, 422);
  const paths = r.json.errors.map((e) => e.path);
  assert.ok(paths.includes("categories.0.items.0.price"), paths.join());
  assert.ok(paths.includes("categories.0.items.1.name"), paths.join());
  assert.ok(paths.includes("categories.0.items.2.id"), paths.join());

  const runs = (await owner.call("GET", "/api/admin/content/runs")).json;
  const bad = structuredClone(runs.doc);
  bad.events[0].ends = "2020-01-01T00:00";
  const r2 = await owner.call("PUT", "/api/admin/content/runs", { doc: bad, rev: runs.rev });
  assert.equal(r2.status, 422);
  assert.ok(r2.json.errors.some((e) => e.path === "events.0.ends" && /before the start/.test(e.message)));
});

test("removing a package the quiz recommends is refused", async () => {
  const offer = (await owner.call("GET", "/api/admin/content/offer")).json;
  const doc = structuredClone(offer.doc);
  doc.packages = doc.packages.filter((p) => p.id !== "the-reset");
  const r = await owner.call("PUT", "/api/admin/content/offer", { doc, rev: offer.rev });
  assert.equal(r.status, 422);
  assert.ok(r.json.errors.some((e) => /quiz/.test(e.message)));
});

test("settings are checked (WhatsApp digits, https links)", async () => {
  const s = (await owner.call("GET", "/api/admin/content/settings")).json;
  const doc = { ...s.doc, whatsapp: "+961 70 123", bookingUrl: "javascript:alert(1)" };
  const r = await owner.call("PUT", "/api/admin/content/settings", { doc, rev: s.rev });
  assert.equal(r.status, 422);
  const paths = r.json.errors.map((e) => e.path);
  assert.ok(paths.includes("whatsapp") && paths.includes("bookingUrl"), paths.join());
});

test("a stale save (edited elsewhere meanwhile) is refused instead of overwriting", async () => {
  const shop = (await owner.call("GET", "/api/admin/content/shop")).json;
  const r = await owner.call("PUT", "/api/admin/content/shop", { doc: shop.doc, rev: shop.rev - 1 });
  assert.equal(r.status, 409);
});

test("saving a draft doesn't touch the website; publishing writes the real files", async () => {
  const shop = (await owner.call("GET", "/api/admin/content/shop")).json;
  const doc = structuredClone(shop.doc);
  const t = tee(doc);
  t.price = "25";
  t.stock = { S: 3, M: 0, L: "", XL: 5 };
  t.ar.name = "قميص النادي";
  const saved = await owner.call("PUT", "/api/admin/content/shop", { doc, rev: shop.rev });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  assert.equal(saved.json.rev, shop.rev + 1);
  assert.equal(tee(saved.json.doc).price, 25, "normalised to a number");
  assert.deepEqual(tee(saved.json.doc).stock, { S: 3, M: 0, XL: 5 }, "empty boxes = not tracked");

  const status = (await owner.call("GET", "/api/admin/status")).json;
  assert.equal(status.changed.shop, true);
  assert.equal(status.changed.runs, false);

  const pub = await owner.call("POST", "/api/admin/publish", { note: "Tee price and stock" });
  assert.equal(pub.status, 200, JSON.stringify(pub.json));

  const live = liveData("products.js", "SITE_SHOP");
  const liveTee = live.categories[0].items.find((p) => p.id === "sotr-tee");
  assert.equal(liveTee.price, 25);
  assert.deepEqual(liveTee.stock, { S: 3, M: 0, XL: 5 });
  assert.equal(liveTee.ar, undefined, "Arabic is not left in the English file");
  assert.equal(liveData("ar.js", "SITE_AR").shop.items["sotr-tee"].name, "قميص النادي");
  assert.equal(liveData("ar.js", "SITE_AR").posts["a-month-in-shanghai"].title, "شهر في شنغهاي", "untouched Arabic carried through");
  assert.ok(liveData("runs.js", "SITE_RUNS").events.length >= 5);
  assert.ok(liveData("config.js", "SITE").emails);

  const after = (await owner.call("GET", "/api/admin/status")).json;
  assert.equal(after.changed.shop, false);
  assert.equal(after.last_publish.note, "Tee price and stock");
});

test("history: restoring the imported version, then publishing, puts the old price back", async () => {
  const hist = (await owner.call("GET", "/api/admin/history")).json.versions;
  assert.equal(hist.length, 2);
  assert.equal(hist[0].note, "Tee price and stock");
  assert.equal(hist[0].by, "owner@example.com");
  const imported = hist[1];
  assert.equal((await owner.call("POST", `/api/admin/history/${imported.id}/restore`, {})).status, 200);
  assert.equal((await owner.call("GET", "/api/admin/status")).json.changed.shop, true);
  assert.equal(liveData("products.js", "SITE_SHOP").categories[0].items[0].price, 25, "restore alone doesn't publish");
  await owner.call("POST", "/api/admin/publish", { note: "" });
  assert.equal(liveData("products.js", "SITE_SHOP").categories[0].items[0].price, null);
});

test("discard throws away saved-but-unpublished changes", async () => {
  const runs = (await owner.call("GET", "/api/admin/content/runs")).json;
  const doc = structuredClone(runs.doc);
  doc.events.push({ id: "test-run", kind: "run", title: "Test run", starts: "2030-01-01T18:00", ends: "2030-01-01T19:00", place: "", detail: "", note: "", featured: false });
  assert.equal((await owner.call("PUT", "/api/admin/content/runs", { doc, rev: runs.rev })).status, 200);
  assert.equal((await owner.call("GET", "/api/admin/status")).json.changed.runs, true);
  assert.equal((await owner.call("POST", "/api/admin/discard", {})).status, 200);
  const back = (await owner.call("GET", "/api/admin/content/runs")).json;
  assert.ok(!back.doc.events.some((e) => e.id === "test-run"));
  assert.equal((await owner.call("GET", "/api/admin/status")).json.changed.runs, false);
});

test("inviting a second admin: wrong code refused, right code → own password + own phone", async () => {
  const inv = await owner.call("POST", "/api/admin/admins/invite", { email: "Fatima@Example.com" });
  assert.equal(inv.status, 200);
  assert.match(inv.json.code, /^[a-z0-9]{5}-[a-z0-9]{5}$/);

  const fatima = client(srv.base);
  await fatima.state();
  const wrong = await fatima.call("POST", "/api/auth/invite/accept", { email: "fatima@example.com", code: "aaaaa-aaaaa", password: "lemon cedar sunset track" });
  assert.equal(wrong.status, 401);
  const ok = await fatima.call("POST", "/api/auth/invite/accept", { email: "fatima@example.com", code: inv.json.code, password: "lemon cedar sunset track" });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.next, "enroll");
  await enrol(fatima);
  assert.equal((await fatima.call("GET", "/api/admin/status")).status, 200, "the new admin can work");

  const again = await client(srv.base);
  await again.state();
  const reuse = await again.call("POST", "/api/auth/invite/accept", { email: "fatima@example.com", code: inv.json.code, password: "lemon cedar sunset track" });
  assert.equal(reuse.status, 401, "an invite works once");

  const list = (await owner.call("GET", "/api/admin/admins")).json;
  assert.deepEqual(list.admins.map((a) => a.email), ["owner@example.com", "fatima@example.com"]);
  assert.equal(list.invites.length, 0);

  // Can't remove yourself; can remove someone else, which signs them out.
  const self = list.admins.find((a) => a.you);
  assert.equal((await owner.call("POST", `/api/admin/admins/${self.id}/remove`, {})).status, 409);
  const other = list.admins.find((a) => !a.you);
  assert.equal((await owner.call("POST", `/api/admin/admins/${other.id}/remove`, {})).status, 200);
  assert.equal((await fatima.call("GET", "/api/admin/status")).status, 401);
});

test("changing your email needs your password", async () => {
  const bad = await owner.call("POST", "/api/auth/email", { email: "new@example.com", password: "nope nope nope" });
  assert.equal(bad.status, 401);
  const ok = await owner.call("POST", "/api/auth/email", { email: "new@example.com", password: "three purple running shoes" });
  assert.equal(ok.status, 200);
  assert.equal((await owner.state()).user.email, "new@example.com");
});
