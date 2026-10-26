/* The October 2026 shop update, end to end. The live database still holds the shop exactly as it
   was on 2 Oct (cap, one "Sports Socks", a Run Bag, no prices on the tee). This rebuilds that
   database, lets the first request after the deploy upgrade it, and checks what she would see:
   the changes wait as drafts, Publish puts them live, hidden products never reach visitors,
   and the checkout offers pay on delivery only until Whish / OMT is switched on.
     node --test server/tests/shop-update.test.mjs */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { DatabaseSync } from "node:sqlite";
import { startServer, client, enrol, root } from "./helpers.mjs";

const TOKEN = "shop-update-test-token-0123456789";
let srv, owner;

const seed = JSON.parse(readFileSync(join(root, "server", "database", "seed", "content.json"), "utf8")).areas;
const oldShop = JSON.parse(readFileSync(join(root, "server", "tests", "fixtures", "shop-before-2026-10.json"), "utf8")).shop;
const NEW_PHOTO = /^shop-(belt-|pouch-|socks-)/;

const live = (file, global) => {
  const box = { window: {} };
  vm.runInNewContext(readFileSync(join(srv.site, "data", file), "utf8"), box);
  return JSON.parse(JSON.stringify(box.window[global]));
};
const items = (shop) => shop.categories.flatMap((c) => c.items);
const draftShop = async () => (await owner.call("GET", "/api/admin/content/shop")).json;

async function visit(path, body) {
  const res = await fetch(srv.base + path, { method: "POST", headers: { "content-type": "application/json", origin: srv.base }, body: JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch { /* none */ }
  return { status: res.status, json };
}
const order = (lines, extra = {}) => visit("/api/orders", {
  name: "Nour Haddad", phone: "+961 70 123 456", governorate: "Beirut", address: "Hamra, Bliss Street, building 4, floor 2",
  payment_method: "cod", items: lines, ...extra,
});

before(async () => {
  srv = await startServer({ port: 8203, setupToken: TOKEN, extra: "'limits'=>['orders_per_hour'=>1000,'messages_per_hour'=>1000]" });
  owner = client(srv.base);
  await owner.state();
  await owner.call("POST", "/api/auth/setup", { token: TOKEN, email: "owner@example.com", password: "three purple running shoes" });
  await enrol(owner);
  await owner.call("GET", "/api/admin/status"); // a fresh install: seeds the new shop

  // Turn the database back into the live site as it was before this update.
  const db = new DatabaseSync(srv.db);
  const oldImages = { items: seed.images.items.filter((i) => !NEW_PHOTO.test(i.name)).map((i) => (i.name === "shop-belt" ? { ...i, w: [480, 628] } : i)) };
  const put = (area, doc) => db.prepare("UPDATE content SET doc = ? WHERE area = ?").run(JSON.stringify(doc), area);
  put("shop", oldShop);
  put("images", oldImages);
  const extras = JSON.parse(db.prepare("SELECT doc FROM content WHERE area='extras'").get().doc);
  delete extras.upgrades;
  put("extras", extras);
  const oldSettings = JSON.parse(db.prepare("SELECT doc FROM content WHERE area='settings'").get().doc);
  delete oldSettings.adminOrders; // the live site started without order-taking switched on
  put("settings", oldSettings);
  const snap = JSON.parse(db.prepare("SELECT snapshot FROM publishes ORDER BY id DESC LIMIT 1").get().snapshot);
  snap.shop = oldShop;
  snap.images = oldImages;
  snap.extras = extras;
  snap.settings = oldSettings;
  db.prepare("UPDATE publishes SET snapshot = ? WHERE id = (SELECT MAX(id) FROM publishes)").run(JSON.stringify(snap));
  db.close();
});
after(() => srv?.stop());

test("the seed a brand-new site starts from already has the new shop", () => {
  const ids = items(seed.shop).map((p) => p.id);
  assert.ok(ids.includes("pick-arm-bag") && !ids.includes("sotr-cap") && !ids.includes("sotr-socks"));
});

test("the first request after the deploy puts the changes in the DRAFTS only", async () => {
  const st = (await owner.call("GET", "/api/admin/status")).json;
  assert.equal(st.changed.shop, true, "she sees the shop has unpublished changes");
  assert.equal(st.changed.images, true, "and so does the photo library");
  assert.equal(st.changed.settings, true, "and the switch that makes the checkout take real orders");
  for (const area of ["runs", "offer", "testimonials", "posts", "gallery"]) assert.equal(st.changed[area], false, area);

  const ids = items((await draftShop()).doc).map((p) => p.id);
  assert.deepEqual(ids, [
    "sotr-tee", "sotr-bag", "socks-grip-white", "socks-striped", "socks-corgi", "socks-cherry",
    "food-scale", "measuring-cups", "portion-set", "journal",
    "pick-belt", "pick-arm-bag", "pick-bottle", "pick-shaker",
  ]);

  // The live site is untouched until she publishes.
  const db = new DatabaseSync(srv.db);
  const snap = JSON.parse(db.prepare("SELECT snapshot FROM publishes ORDER BY id DESC LIMIT 1").get().snapshot);
  const audit = db.prepare("SELECT action, detail FROM audit_log WHERE action LIKE 'content.upgrade%'").all();
  db.close();
  assert.deepEqual(snap.shop, oldShop, "the live shop is exactly as it was");
  assert.ok(items(snap.shop).some((p) => p.id === "sotr-cap"));
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, "content.upgraded");
  assert.match(audit[0].detail, /shop-2026-10 \(shop, images, settings\)/);
});

test("the draft shop is what she asked for", async () => {
  const byId = Object.fromEntries(items((await draftShop()).doc).map((p) => [p.id, p]));
  assert.equal(byId["sotr-tee"].price, 30);
  assert.deepEqual(["socks-grip-white", "socks-striped", "socks-corgi", "socks-cherry"].map((id) => byId[id].price), [3, 3, 5, 5]);
  for (const id of ["sotr-bag", "food-scale", "measuring-cups", "portion-set", "journal", "pick-bottle", "pick-shaker"]) assert.equal(byId[id].hidden, true, `${id} is hidden, not deleted`);
  assert.equal(byId["pick-belt"].price, 12);
  assert.deepEqual(byId["pick-belt"].options, ["Burgundy", "Black", "Navy"]);
  assert.deepEqual(Object.keys(byId["pick-belt"].optionPhotos), ["Burgundy", "Black", "Navy"]);
  assert.equal(byId["pick-arm-bag"].price, 12);
  assert.deepEqual(byId["pick-arm-bag"].options, ["Cream", "Pink"]);
});

test("the photo library gains the 26 new photos, each marked as used by its product", async () => {
  const photos = (await owner.call("GET", "/api/admin/photos")).json.photos;
  assert.equal(photos.length, 120);
  assert.equal(photos.filter((p) => NEW_PHOTO.test(p.name)).length, 26);
  assert.deepEqual(photos.find((p) => p.name === "shop-belt").w, [160, 480, 628]);
  const worn = photos.find((p) => p.name === "shop-belt-black-worn");
  assert.deepEqual(worn.used, ["product “Running Belt”"], "a colour photo counts as in use, so it can't be deleted from under the product");
  assert.deepEqual(photos.find((p) => p.name === "shop-socks-cherry-detail").used, ["product “Cherry Grip Socks”"], "so does an extra photo");
});

test("upgrading again changes nothing", async () => {
  const a = await draftShop();
  await owner.call("GET", "/api/admin/status");
  await owner.call("GET", "/api/admin/photos");
  assert.equal((await draftShop()).rev, a.rev);
});

test("the admin editor is told about the new fields", async () => {
  const schema = (await owner.call("GET", "/api/admin/schema")).json.areas.shop;
  const product = schema.fields.find((f) => f.key === "categories").item.find((f) => f.key === "items").item;
  const type = (key) => product.find((f) => f.key === key)?.type;
  assert.equal(type("gallery"), "photos");
  assert.equal(type("optionPhotos"), "optionphotos");
  assert.equal(type("hidden"), "bool");
  assert.equal(product.find((f) => f.key === "options").arOptional, true, "Arabic colours are optional, so sizes never show “Arabic missing”");
  const settings = (await owner.call("GET", "/api/admin/schema")).json.areas.settings;
  assert.equal(settings.fields.find((f) => f.key === "payTransfer").type, "bool");
});

test("saving a bad photo or a mismatched Arabic list is refused beside the field", async () => {
  const shop = await draftShop();
  const doc = structuredClone(shop.doc);
  const belt = items(doc).find((p) => p.id === "pick-belt");
  belt.gallery = ["Not A Photo!"];
  belt.ar.options = ["عنّابي"];
  const r = await owner.call("PUT", "/api/admin/content/shop", { doc, rev: shop.rev });
  assert.equal(r.status, 422);
  const paths = r.json.errors.map((e) => e.path);
  assert.ok(paths.some((p) => p.endsWith(".gallery")), paths.join());
  assert.ok(paths.some((p) => p.endsWith(".ar.options")), paths.join());
});

test("Publish puts it live: hidden products never reach the public files", async () => {
  const pub = await owner.call("POST", "/api/admin/publish", { note: "October shop update" });
  assert.equal(pub.status, 200, JSON.stringify(pub.json));
  const shop = live("products.js", "SITE_SHOP");
  const ids = items(shop).map((p) => p.id);
  assert.deepEqual(ids, ["sotr-tee", "socks-grip-white", "socks-striped", "socks-corgi", "socks-cherry", "pick-belt", "pick-arm-bag"]);
  const text = readFileSync(join(srv.site, "data", "products.js"), "utf8");
  assert.ok(!/food-scale|sotr-bag|pick-bottle|"hidden"/.test(text), "hidden products leave no trace in the public file");
  const belt = items(shop).find((p) => p.id === "pick-belt");
  assert.deepEqual(belt.optionPhotos.Black, ["shop-belt-black-front", "shop-belt-black-worn", "shop-belt-black-back", "shop-belt-black-zip"]);
  assert.equal(belt.ar, undefined, "Arabic is not left in the English file");
  const ar = live("ar.js", "SITE_AR");
  assert.deepEqual(ar.shop.items["pick-belt"].options, ["عنّابي", "أسود", "كحلي"]);
  assert.equal(ar.shop.items["food-scale"], undefined, "hidden products' Arabic isn't published either");
  assert.ok(live("images.js", "SITE_IMAGES")["shop-belt-black-worn"].altAr, "photo descriptions are published in Arabic too");
  assert.equal((await owner.call("GET", "/api/admin/status")).json.changed.shop, false);
});

test("a hidden product can't be ordered, even by someone who still has it in their cart", async () => {
  const r = await order([{ id: "food-scale", option: "", qty: 1 }]);
  assert.equal(r.status, 409);
  assert.equal(r.json.code, "gone");
  assert.equal((await order([{ id: "sotr-cap", option: "", qty: 1 }])).json.code, "gone", "the removed cap neither");
});

test("a colour is chosen like a size: required, and it has to be one of hers", async () => {
  assert.equal((await order([{ id: "pick-belt", option: "", qty: 1 }])).json.code, "bad_option");
  assert.equal((await order([{ id: "pick-belt", option: "Green", qty: 1 }])).json.code, "bad_option");
  assert.equal((await order([{ id: "socks-corgi", option: "Black", qty: 1 }])).json.code, "bad_option", "socks have no colours to choose");
  const ok = await order([{ id: "pick-belt", option: "Black", qty: 2 }, { id: "socks-corgi", option: "", qty: 1 }, { id: "sotr-tee", option: "M", qty: 1 }]);
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  assert.equal(ok.json.total, 2 * 12 + 5 + 30, "the server uses her prices");
});

test("checkout is pay on delivery only, until Whish / OMT is switched on", async () => {
  const lines = [{ id: "socks-cherry", option: "", qty: 1 }];
  const refused = await order(lines, { payment_method: "transfer" });
  assert.equal(refused.status, 422);
  assert.equal(refused.json.field, "payment_method");
  assert.match(refused.json.error, /pay on delivery/i);
  assert.equal((await order(lines, { payment_method: "cod" })).status, 201);

  const set = (await owner.call("GET", "/api/admin/content/settings")).json;
  assert.equal(set.doc.adminOrders, true, "the upgrade switched order-taking on");
  assert.equal(set.doc.payTransfer, undefined, "off unless she turns it on");
  assert.equal((await owner.call("PUT", "/api/admin/content/settings", { doc: { ...set.doc, payTransfer: true }, rev: set.rev })).status, 200);
  assert.equal((await order(lines, { payment_method: "transfer" })).status, 422, "saved as a draft: not live yet");
  assert.equal((await owner.call("POST", "/api/admin/publish", { note: "Whish / OMT on" })).status, 200);
  assert.equal(live("config.js", "SITE").payTransfer, true, "the checkout page is told");
  assert.equal((await order(lines, { payment_method: "transfer" })).status, 201);
});

test("the public pages and the photo files exist", () => {
  for (const f of ["shop-belt-black-worn-508.jpg", "shop-belt-black-worn-160.webp", "shop-pouch-pink-front-507.jpg", "shop-socks-corgi-sole-638.webp"]) {
    assert.ok(existsSync(join(root, "public", "images", f)), f);
  }
});
