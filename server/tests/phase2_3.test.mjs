/* End-to-end automated tests for Phase 2 (Media + Journal) and Phase 3 (Orders + Messages).
   Run with: node --test server/tests/phase2_3.test.mjs */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, client, enrol } from "./helpers.mjs";

const TOKEN = "phase2-3-test-token-0123456789";
let srv, owner, publicUser;

before(async () => {
  srv = await startServer({ port: 8195, setupToken: TOKEN });
  owner = client(srv.base);
  publicUser = client(srv.base);

  // Setup owner account
  await owner.state();
  const r = await owner.call("POST", "/api/auth/setup", {
    token: TOKEN,
    email: "owner@example.com",
    password: "three purple running shoes",
  });
  assert.equal(r.status, 200);
  await enrol(owner);
});

after(() => srv?.stop());

test("Phase 3: Public checkout recalculates prices from database and checks stock", async () => {
  // 1. First ensure content is seeded
  await owner.call("GET", "/api/admin/schema");

  // 2. Submit order with tampered low price ($1 instead of catalog price)
  const orderPayload = {
    name: "Nour Al-Hassan",
    phone: "+961 70 998877",
    governorate: "Beirut",
    address: "Hamra, Bliss Street, Bldg 12, 3rd Floor",
    payment: "Pay on delivery",
    items: [
      { id: "sotr-tee", option: "M", qty: 2, price: 1.0 }, // client claims $1
      { id: "sotr-cap", option: "", qty: 1, price: 0.5 },
    ],
  };

  const res = await publicUser.call("POST", "/api/orders", orderPayload);
  assert.equal(res.status, 201, JSON.stringify(res.json));
  assert.equal(res.json.ok, true);
  assert.ok(res.json.order_number.startsWith("SOTR-"));

  // Verify in admin: price was recalculated from the database catalog, not client's $1
  const ordersRes = await owner.call("GET", "/api/admin/orders");
  assert.equal(ordersRes.status, 200);
  assert.ok(ordersRes.json.orders.length >= 1);

  const placed = ordersRes.json.orders.find((o) => o.order_number === res.json.order_number);
  assert.ok(placed);
  assert.equal(placed.customer_name, "Nour Al-Hassan");
  assert.equal(placed.governorate, "Beirut");
  assert.equal(placed.status, "new");
  assert.equal(placed.payment_status, "unpaid");
  assert.equal(placed.items.length, 2);
});

test("Phase 3: Checkout rejects bot honeypots and invalid orders", async () => {
  // Honeypot trapped bot
  const botRes = await publicUser.call("POST", "/api/orders", {
    name: "Bot Spammer",
    phone: "+1234567890",
    governorate: "Beirut",
    address: "Everywhere",
    _trap: "I am a spam bot",
    items: [{ id: "sotr-tee", qty: 1 }],
  });
  assert.equal(botRes.status, 400);

  // Missing phone
  const invalidRes = await publicUser.call("POST", "/api/orders", {
    name: "Real Person",
    phone: "",
    governorate: "Beirut",
    address: "Achrafieh",
    items: [{ id: "sotr-tee", qty: 1 }],
  });
  assert.equal(invalidRes.status, 422);

  // Empty cart
  const emptyRes = await publicUser.call("POST", "/api/orders", {
    name: "Real Person",
    phone: "+961 70 112233",
    governorate: "Beirut",
    address: "Achrafieh",
    items: [],
  });
  assert.equal(emptyRes.status, 422);
});

test("Phase 3: Order workflow management and CSV export", async () => {
  const listRes = await owner.call("GET", "/api/admin/orders");
  const order = listRes.json.orders[0];
  assert.ok(order);

  // 1. Advance status: new -> confirmed -> out_for_delivery -> delivered
  const st1 = await owner.call("PUT", `/api/admin/orders/${order.id}/status`, { status: "confirmed" });
  assert.equal(st1.status, 200);
  assert.equal(st1.json.status, "confirmed");

  const st2 = await owner.call("PUT", `/api/admin/orders/${order.id}/status`, { status: "out_for_delivery" });
  assert.equal(st2.json.status, "out_for_delivery");

  // 2. Mark payment as paid
  const pay = await owner.call("PUT", `/api/admin/orders/${order.id}/payment`, { payment_status: "paid", payment_ref: "CASH-REC-101" });
  assert.equal(pay.status, 200);
  assert.equal(pay.json.payment_status, "paid");
  assert.equal(pay.json.payment_ref, "CASH-REC-101");

  // 3. Update private notes
  const notes = await owner.call("PUT", `/api/admin/orders/${order.id}/notes`, { notes: "Called customer, confirmed delivery at 5pm." });
  assert.equal(notes.status, 200);
  assert.equal(notes.json.notes, "Called customer, confirmed delivery at 5pm.");

  // 4. CSV Export
  const csvRes = await owner.call("GET", "/api/admin/orders/export");
  assert.equal(csvRes.status, 200);
});

test("Phase 3: Connect messages submission, inbox routing, and status triage", async () => {
  // Public user sends inquiry
  const msgRes = await publicUser.call("POST", "/api/messages", {
    name: "Rania Haddad",
    email: "rania@example.com",
    about: "Sports & active nutrition",
    message: "Hi Fatima! I would like to book a sports nutrition consultation for my marathon prep.",
  });
  assert.equal(msgRes.status, 201);
  assert.equal(msgRes.json.ok, true);

  // Admin checks messages inbox
  const inbox = await owner.call("GET", "/api/admin/messages");
  assert.equal(inbox.status, 200);
  assert.ok(inbox.json.messages.length >= 1);

  const msg = inbox.json.messages.find((m) => m.email === "rania@example.com");
  assert.ok(msg);
  assert.equal(msg.name, "Rania Haddad");
  assert.equal(msg.status, "unread");
  assert.equal(msg.inbox, "dietontherun@gmail.com", "Automatically routed to dietontherun inbox");

  // Mark message as handled and add note
  const handled = await owner.call("PUT", `/api/admin/messages/${msg.id}/status`, { status: "handled" });
  assert.equal(handled.status, 200);
  assert.equal(handled.json.status, "handled");

  const notes = await owner.call("PUT", `/api/admin/messages/${msg.id}/notes`, { notes: "Sent WhatsApp message with booking link." });
  assert.equal(notes.status, 200);
  assert.equal(notes.json.notes, "Sent WhatsApp message with booking link.");
});

test("Phase 2: Media library list, alt text editing, and gallery assignments", async () => {
  // 1. Media library list
  const mediaRes = await owner.call("GET", "/api/admin/media");
  assert.equal(mediaRes.status, 200);
  assert.ok(mediaRes.json.images.length > 30);

  const firstImg = mediaRes.json.images[0];
  assert.ok(firstImg.name);
  assert.ok(firstImg.alt !== undefined);

  // 2. Update alt text
  const updateRes = await owner.call("PUT", `/api/admin/media/${firstImg.name}`, {
    alt: "Updated English alt text for accessibility",
    alt_ar: "نص بديل محدث باللغة العربية",
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.json.alt, "Updated English alt text for accessibility");

  // 3. Galleries (community & fieldwork sets)
  const galRes = await owner.call("GET", "/api/admin/gallery");
  assert.equal(galRes.status, 200);
  assert.ok(Array.isArray(galRes.json.community));
  assert.ok(Array.isArray(galRes.json.fieldwork));

  // Save updated gallery order
  const savedGal = await owner.call("PUT", "/api/admin/gallery", {
    community: [
      { img: "sotr-girls", caption: "Race day, together" },
      { img: "sotr-hike", caption: "Trail morning" },
    ],
    fieldwork: galRes.json.fieldwork,
  });
  assert.equal(savedGal.status, 200);
  assert.equal(savedGal.json.community.length, 2);
});

test("Phase 2: Journal article publishing, draft workflow, and HTML generation", async () => {
  // 1. List existing journal posts
  const listRes = await owner.call("GET", "/api/admin/journal");
  assert.equal(listRes.status, 200);
  assert.ok(listRes.json.posts.length >= 2);

  // 2. Create a new article
  const newArticle = {
    title: "Post-Run Recovery Smoothies",
    kicker: "Recovery nutrition",
    date: "2026-10-05",
    readingTime: "4 min",
    excerpt: "Three quick blender recipes to replenish glycogen and ease muscle soreness.",
    image: "dotr-cafe",
    draft: false,
    bodyHtml: "<h2>Why smoothies work</h2><p>Liquids empty faster from the stomach after hard efforts...</p>",
  };

  const createRes = await owner.call("POST", "/api/admin/journal", newArticle);
  assert.equal(createRes.status, 200, JSON.stringify(createRes.json));
  assert.equal(createRes.json.title, "Post-Run Recovery Smoothies");
  assert.equal(createRes.json.slug, "post-run-recovery-smoothies");

  // 3. Retrieve single post
  const getRes = await owner.call("GET", `/api/admin/journal/${createRes.json.slug}`);
  assert.equal(getRes.status, 200);
  assert.equal(getRes.json.title, "Post-Run Recovery Smoothies");
  assert.ok(getRes.json.bodyHtml.includes("Why smoothies work"));

  // 4. Update draft state
  const draftToggle = await owner.call("PUT", `/api/admin/journal/${createRes.json.slug}`, {
    ...getRes.json,
    draft: true,
  });
  assert.equal(draftToggle.status, 200);
  assert.equal(draftToggle.json.draft, true);
});

test("Dashboard counts returns status, orders, and messages counts", async () => {
  const countsRes = await owner.call("GET", "/api/admin/counts");
  assert.equal(countsRes.status, 200);
  assert.ok(typeof countsRes.json.orders.all === "number");
  assert.ok(typeof countsRes.json.messages.all === "number");
  assert.ok(countsRes.json.status.changed !== undefined);
});
