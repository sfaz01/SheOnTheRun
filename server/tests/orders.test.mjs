/* Phase 3 end-to-end: the public checkout and contact form against a real PHP server, a real
   (fake) mail server, and the admin that manages what they create.
     node --test server/tests/orders.test.mjs */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { startServer, startSmtp, client, enrol } from "./helpers.mjs";

const TOKEN = "orders-test-token-0123456789";
const SMTP_PORT = 2525;
let srv, smtp, owner;

const live = (file, global) => {
  const box = { window: {} };
  vm.runInNewContext(readFileSync(join(srv.site, "data", file), "utf8"), box);
  return JSON.parse(JSON.stringify(box.window[global]));
};
const liveItem = (id) => live("products.js", "SITE_SHOP").categories.flatMap((c) => c.items).find((p) => p.id === id);
const draftItem = async (id) => (await owner.call("GET", "/api/admin/content/shop")).json.doc.categories.flatMap((c) => c.items).find((p) => p.id === id);

/** What a visitor's browser does: JSON with an Origin header, no session. */
async function visit(base, path, body, { origin = base, type = "application/json" } = {}) {
  const headers = { "content-type": type };
  if (origin) headers.origin = origin;
  const res = await fetch(base + path, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch { /* none */ }
  return { status: res.status, json };
}
const order = (items, extra = {}) => visit(srv.base, "/api/orders", {
  name: "Nour Haddad", phone: "+961 70 123 456", governorate: "Beirut", address: "Hamra, Bliss Street, building 4, floor 2",
  payment_method: "cod", items, ...extra,
});

before(async () => {
  smtp = await startSmtp(SMTP_PORT);
  srv = await startServer({
    port: 8197, setupToken: TOKEN,
    extra: `'limits'=>['orders_per_hour'=>1000,'messages_per_hour'=>1000],'mail'=>['from'=>'orders@sheontherun.com','smtp_host'=>'127.0.0.1','smtp_port'=>${SMTP_PORT},'smtp_secure'=>'none','smtp_user'=>'u','smtp_pass'=>'p']`,
  });
  owner = client(srv.base);
  await owner.state();
  await owner.call("POST", "/api/auth/setup", { token: TOKEN, email: "owner@example.com", password: "three purple running shoes" });
  await enrol(owner);

  // The owner sets prices/stock/inboxes and publishes: this is what visitors will order from.
  const shop = (await owner.call("GET", "/api/admin/content/shop")).json;
  const doc = structuredClone(shop.doc);
  const items = doc.categories[0].items;
  Object.assign(items.find((p) => p.id === "sotr-tee"), { price: 25, stock: { S: 3, M: 0, L: 2, XL: 5 } });
  Object.assign(items.find((p) => p.id === "sotr-cap"), { price: 10, stock: 2 });
  Object.assign(items.find((p) => p.id === "sotr-bag"), { price: null });
  assert.equal((await owner.call("PUT", "/api/admin/content/shop", { doc, rev: shop.rev })).status, 200);
  const set = (await owner.call("GET", "/api/admin/content/settings")).json;
  const sdoc = { ...set.doc, email: "owner-inbox@example.com", emails: { ...set.doc.emails, nutrition: "diet@example.com", general: "general@example.com", events: "events@example.com", sheontherun: "club@example.com", research: "research@example.com" } };
  assert.equal((await owner.call("PUT", "/api/admin/content/settings", { doc: sdoc, rev: set.rev })).status, 200);
  assert.equal((await owner.call("POST", "/api/admin/publish", { note: "ready for orders" })).status, 200);
});
after(() => { srv?.stop(); smtp?.stop(); });

test("nothing is accepted without a same-origin JSON request", async () => {
  const ok = [{ id: "sotr-cap", option: "", qty: 1 }];
  assert.equal((await visit(srv.base, "/api/orders", { items: ok }, { origin: "https://evil.example" })).status, 403);
  assert.equal((await visit(srv.base, "/api/orders", { items: ok }, { origin: "" })).status, 403);
  assert.equal((await visit(srv.base, "/api/orders", "name=x", { type: "application/x-www-form-urlencoded" })).status, 415);
});

test("every field is checked, with a message pointing at the field", async () => {
  const items = [{ id: "sotr-cap", option: "", qty: 1 }];
  const field = async (patch) => { const r = await order(items, patch); return [r.status, r.json.field]; };
  assert.deepEqual(await field({ name: "A" }), [422, "name"]);
  assert.deepEqual(await field({ phone: "abc" }), [422, "phone"]);
  assert.deepEqual(await field({ governorate: "Atlantis" }), [422, "governorate"]);
  assert.deepEqual(await field({ address: "x" }), [422, "address"]);
  assert.deepEqual(await field({ payment_method: "bitcoin" }), [422, "payment_method"]);
  assert.equal((await order([])).status, 422);
  assert.equal((await order([{ id: "sotr-cap", option: "", qty: 0 }])).status, 422);
  assert.equal((await order([{ id: "sotr-cap", option: "", qty: 11 }])).status, 422);
  assert.equal((await order([{ id: "does-not-exist", option: "", qty: 1 }])).status, 409);
  assert.equal((await order([{ id: "sotr-tee", option: "XXL", qty: 1 }])).json.code, "bad_option", "an unknown size is refused, never swapped for another");
  assert.equal((await order([{ id: "sotr-tee", option: "", qty: 1 }])).json.code, "bad_option", "a sized product needs a size");
  assert.equal((await order([{ id: "sotr-cap", option: "S", qty: 1 }])).json.code, "bad_option");
  assert.equal((await order([{ id: "modest-leggings", option: "", qty: 1 }])).status, 409, "a Coming soon category can't be ordered from");
});

test("sold-out sizes and over-ordering are refused with a clear message, and nothing is taken", async () => {
  const soldOut = await order([{ id: "sotr-tee", option: "M", qty: 1 }]);
  assert.equal(soldOut.status, 409);
  assert.match(soldOut.json.error, /sold out/);
  const tooMany = await order([{ id: "sotr-tee", option: "S", qty: 4 }]);
  assert.equal(tooMany.status, 409);
  assert.match(tooMany.json.error, /Only 3 left/);
  assert.equal(liveItem("sotr-tee").stock.S, 3);
  assert.equal((await owner.call("GET", "/api/admin/orders")).json.total, 0);
});

test("the server decides the price, stock drops live and in the draft, and the owner is emailed", async () => {
  const placed = await order([{ id: "sotr-tee", option: "S", qty: 2 }, { id: "sotr-cap", option: "", qty: 1 }], { total: 1, price: 0.01, items_total: 0 });
  assert.equal(placed.status, 201, JSON.stringify(placed.json));
  assert.match(placed.json.order_number, /^SOTR-[A-Z2-9]{6}$/);
  assert.equal(placed.json.total, 60, "2 × $25 + $10 — whatever the browser claimed");

  assert.equal(liveItem("sotr-tee").stock.S, 1, "the live shop shows the new stock");
  assert.equal(liveItem("sotr-cap").stock, 1);
  assert.equal((await draftItem("sotr-tee")).stock.S, 1, "and so does the owner's draft");
  const st = (await owner.call("GET", "/api/admin/status")).json;
  assert.equal(st.changed.shop, false, "an order is not an unpublished edit");

  const mail = smtp.mails().at(-1);
  assert.deepEqual(mail.rcpt, ["owner-inbox@example.com"], "the recipient comes from Site settings");
  assert.match(mail.subject, /New order SOTR-/);
  assert.match(mail.body, /Nour Haddad/);
  assert.match(mail.body, /2 × SheOnTheRun Tee \(S\) — \$50\.00/);
  assert.match(mail.body, /Total: \$60\.00/);

  const stored = (await owner.call("GET", "/api/admin/orders")).json.orders[0];
  assert.equal(stored.total, 60);
  assert.equal(stored.mail_status, "sent");
  assert.deepEqual(stored.items.map((i) => [i.name, i.option, i.qty, i.price]), [["SheOnTheRun Tee", "S", 2, 25], ["SheOnTheRun Cap", "", 1, 10]]);
});

test("orders use the PUBLISHED shop, not the owner's unpublished edits", async () => {
  const shop = (await owner.call("GET", "/api/admin/content/shop")).json;
  const doc = structuredClone(shop.doc);
  doc.categories[0].items.find((p) => p.id === "sotr-tee").price = 99; // saved as a draft, never published
  await owner.call("PUT", "/api/admin/content/shop", { doc, rev: shop.rev });
  const r = await order([{ id: "sotr-tee", option: "L", qty: 1 }]);
  assert.equal(r.status, 201);
  assert.equal(r.json.total, 25, "the published price");
  assert.equal((await draftItem("sotr-tee")).price, 99, "the draft edit is untouched");
  assert.equal((await draftItem("sotr-tee")).stock.L, 1, "but the stock change reached it");
  await owner.call("POST", "/api/admin/discard", {});
  assert.equal((await draftItem("sotr-tee")).stock.L, 1, "discarding the draft doesn't bring old stock back");
  assert.equal((await draftItem("sotr-tee")).price, 25);
});

test("the last items can't be sold twice", async () => {
  // L has 1 left, cap has 1 left. Five orders compete for them.
  const results = await Promise.all([1, 2, 3, 4, 5].map(() => order([{ id: "sotr-tee", option: "L", qty: 1 }])));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 4);
  assert.equal(liveItem("sotr-tee").stock.L, 0);
  assert.equal(liveItem("sotr-tee").stock.XL, 5, "other sizes untouched");
});

test("an item without a price is ordered 'to confirm' and doesn't break the total", async () => {
  const r = await order([{ id: "sotr-bag", option: "", qty: 1 }, { id: "sotr-cap", option: "", qty: 1 }]);
  assert.equal(r.status, 201);
  assert.equal(r.json.total, null);
  assert.equal(r.json.unpriced, 1);
  const o = (await owner.call("GET", "/api/admin/orders")).json.orders[0];
  assert.equal(o.total, 10);
  assert.equal(o.unpriced, 1);
});

test("a bot that fills the hidden field gets a fake success and no order", async () => {
  const before = (await owner.call("GET", "/api/admin/orders")).json.total;
  const r = await order([{ id: "sotr-cap", option: "", qty: 1 }], { website: "http://spam.example" });
  assert.equal(r.status, 201);
  assert.equal((await owner.call("GET", "/api/admin/orders")).json.total, before);
});

test("a visitor can't smuggle email headers or choose who is emailed", async () => {
  const count = smtp.mails().length;
  const r = await order([{ id: "sotr-tee", option: "XL", qty: 1 }], { name: "Eve\r\nBcc: victim@evil.example", to: "victim@evil.example", inbox: "victim@evil.example" });
  assert.equal(r.status, 201);
  const mail = smtp.mails()[count];
  assert.ok(!/^Bcc:/im.test(mail.head), mail.head);
  assert.deepEqual(mail.rcpt, ["owner-inbox@example.com"]);
  assert.ok(!mail.rcpt.includes("victim@evil.example"));
  const stored = (await owner.call("GET", "/api/admin/orders?q=Eve")).json.orders[0];
  assert.ok(!/[\r\n]/.test(stored.name));
});

test("admin: needs sign-in, lists, filters, searches", async () => {
  const anon = client(srv.base);
  await anon.state();
  assert.equal((await anon.call("GET", "/api/admin/orders")).status, 401);
  assert.equal((await anon.call("GET", "/api/admin/counts")).status, 401);
  assert.equal((await anon.call("GET", "/api/admin/orders/export")).status, 401);

  const all = (await owner.call("GET", "/api/admin/orders")).json;
  assert.equal(all.counts.all, all.total);
  assert.ok(all.total >= 5);
  assert.equal((await owner.call("GET", "/api/admin/orders?status=new")).json.total, all.counts.new);
  assert.equal((await owner.call("GET", "/api/admin/orders?q=Haddad")).json.total >= 4, true);
  assert.equal((await owner.call("GET", "/api/admin/orders?q=zzzzzz")).json.total, 0);
  assert.equal((await owner.call("GET", "/api/admin/orders?q=%25")).json.total, 0, "% is searched literally");
  const counts = (await owner.call("GET", "/api/admin/counts")).json;
  assert.equal(counts.orders_new, all.counts.new);
});

test("admin: status workflow, payment and notes; cancelling gives the stock back, reviving takes it again", async () => {
  const placed = await order([{ id: "sotr-tee", option: "XL", qty: 2 }]);
  const o = (await owner.call("GET", "/api/admin/orders?q=" + placed.json.order_number)).json.orders[0];
  const xl = () => liveItem("sotr-tee").stock.XL;
  const before = xl();

  assert.equal((await owner.call("PUT", `/api/admin/orders/${o.id}/status`, { status: "confirmed" })).json.status, "confirmed");
  assert.equal((await owner.call("PUT", `/api/admin/orders/${o.id}/status`, { status: "out_for_delivery" })).json.status, "out_for_delivery");
  assert.equal((await owner.call("PUT", `/api/admin/orders/${o.id}/status`, { status: "nonsense" })).status, 422);
  assert.equal(xl(), before, "moving along the workflow doesn't touch stock");

  const paid = await owner.call("PUT", `/api/admin/orders/${o.id}/payment`, { payment_status: "paid", payment_ref: "WHISH-4471" });
  assert.equal(paid.json.payment_status, "paid");
  assert.equal(paid.json.payment_ref, "WHISH-4471");
  assert.equal((await owner.call("PUT", `/api/admin/orders/${o.id}/notes`, { notes: "Called, deliver after 5pm" })).json.notes, "Called, deliver after 5pm");

  await owner.call("PUT", `/api/admin/orders/${o.id}/status`, { status: "cancelled" });
  assert.equal(xl(), before + 2, "cancelled: the 2 shirts are back in stock");
  assert.equal((await draftItem("sotr-tee")).stock.XL, before + 2, "in the draft too");
  await owner.call("PUT", `/api/admin/orders/${o.id}/status`, { status: "cancelled" });
  assert.equal(xl(), before + 2, "cancelling twice doesn't return stock twice");

  // someone else buys most of them meanwhile, so reviving can't be honoured
  await order([{ id: "sotr-tee", option: "XL", qty: Math.min(10, before + 1) }]).then((r) => assert.equal(r.status, 201));
  const revive = await owner.call("PUT", `/api/admin/orders/${o.id}/status`, { status: "new" });
  assert.equal(revive.status, 409);
  assert.equal((await owner.call("GET", `/api/admin/orders/${o.id}`)).json.status, "cancelled", "a refused revive changes nothing");
});

test("admin: deleting an order that holds stock returns it; the CSV is complete and formula-safe", async () => {
  const placed = await order([{ id: "sotr-bag", option: "", qty: 1 }], { name: "=HYPERLINK(\"http://evil\",\"x\")" });
  assert.equal(placed.status, 201, JSON.stringify(placed.json));
  const o = (await owner.call("GET", "/api/admin/orders?q=" + placed.json.order_number)).json.orders[0];

  const csv = await owner.text("/api/admin/orders/export");
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  assert.deepEqual([...csv.bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], "BOM so Excel reads Arabic");
  assert.ok(csv.text.replace(/^﻿/, "").startsWith("Order,"));
  assert.ok(csv.text.includes(placed.json.order_number));
  assert.ok(csv.text.includes("\"'=HYPERLINK"), "a name starting with = is neutralised");
  const total = (await owner.call("GET", "/api/admin/orders")).json.total;
  assert.equal(csv.text.trim().split("\n").filter((l) => /SOTR-/.test(l)).length, total);

  assert.ok(csv.text.includes("+961 70 123 456") && !csv.text.includes("'+961"), "plain phone numbers aren't prefixed");
  const xlBefore = liveItem("sotr-tee").stock.XL;
  const held = await order([{ id: "sotr-tee", option: "XL", qty: 1 }]);
  assert.equal(held.status, 201, JSON.stringify(held.json));
  const h = (await owner.call("GET", "/api/admin/orders?q=" + held.json.order_number)).json.orders[0];
  assert.equal(liveItem("sotr-tee").stock.XL, xlBefore - 1);
  assert.equal((await owner.call("DELETE", `/api/admin/orders/${h.id}`)).status, 200);
  assert.equal(liveItem("sotr-tee").stock.XL, xlBefore, "deleting an order that held stock gives it back");
  assert.equal((await owner.call("DELETE", `/api/admin/orders/${o.id}`)).status, 200);
  assert.equal((await owner.call("GET", `/api/admin/orders/${o.id}`)).status, 404);
});

test("history restore never brings old stock numbers back", async () => {
  const hist = (await owner.call("GET", "/api/admin/history")).json.versions;
  const oldest = hist.at(-1); // the import: nothing had stock numbers back then
  const current = liveItem("sotr-tee").stock;
  assert.equal((await owner.call("POST", `/api/admin/history/${oldest.id}/restore`, {})).status, 200);
  assert.deepEqual((await draftItem("sotr-tee")).stock, current, "the restored draft keeps today's stock");
  assert.equal((await draftItem("sotr-tee")).price, null, "but everything else went back");
  await owner.call("POST", "/api/admin/discard", {});
});

test("Connect form: stored, routed by subject from Site settings, never to an address the visitor chose", async () => {
  const send = (about, extra = {}) => visit(srv.base, "/api/messages", { name: "Rania Haddad", email: "rania@example.com", about, message: "Hi, I'd like to book a first consultation.", ...extra });
  const count = smtp.mails().length;
  assert.equal((await send("nutrition", { inbox: "victim@evil.example" })).status, 201);
  assert.equal((await send("research")).status, 201);
  assert.equal((await send("not-a-topic")).status, 201);
  const mails = smtp.mails().slice(count);
  assert.deepEqual(mails.map((m) => m.rcpt[0]), ["diet@example.com", "research@example.com", "general@example.com"]);
  assert.match(mails[0].head, /Reply-To: rania@example.com/);
  assert.match(mails[0].body, /book a first consultation/);

  assert.equal((await send("general", { email: "not an email" })).status, 422);
  assert.equal((await send("general", { name: "" })).status, 422);
  assert.equal((await send("general", { message: "" })).status, 422);
  const bot = await send("general", { website: "x" });
  assert.equal(bot.status, 201);
  assert.equal((await owner.call("GET", "/api/admin/messages")).json.counts.all, 3, "the bot's message wasn't stored");
});

test("admin messages: unread/handled/archived, notes, delete", async () => {
  const list = (await owner.call("GET", "/api/admin/messages")).json;
  assert.equal(list.counts.unread, 3);
  const m = list.messages[0];
  assert.equal(m.topic_label.length > 0, true);
  assert.equal((await owner.call("PUT", `/api/admin/messages/${m.id}/status`, { status: "handled" })).json.status, "handled");
  assert.equal((await owner.call("PUT", `/api/admin/messages/${m.id}/notes`, { notes: "Replied on WhatsApp" })).json.notes, "Replied on WhatsApp");
  assert.equal((await owner.call("GET", "/api/admin/messages?status=unread")).json.total, 2);
  assert.equal((await owner.call("GET", "/api/admin/counts")).json.messages_unread, 2);
  assert.equal((await owner.call("DELETE", `/api/admin/messages/${m.id}`)).status, 200);
  assert.equal((await owner.call("PUT", "/api/admin/messages/99999/status", { status: "handled" })).status, 404);
});

test("the Site settings switches are saved and published for the checkout and contact form", async () => {
  const set = (await owner.call("GET", "/api/admin/content/settings")).json;
  assert.equal((await owner.call("PUT", "/api/admin/content/settings", { doc: { ...set.doc, adminOrders: true, adminMessages: true }, rev: set.rev })).status, 200);
  await owner.call("POST", "/api/admin/publish", { note: "switch on" });
  const cfg = live("config.js", "SITE");
  assert.equal(cfg.adminOrders, true);
  assert.equal(cfg.adminMessages, true);
});
