/* Phase 4: dashboard numbers, activity log, and backups (download + nightly job).
     node --test server/tests/phase4.test.mjs */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer, client, enrol } from "./helpers.mjs";
import { phpCommand } from "./php.mjs";

const TOKEN = "phase4-test-token-0123456789";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
let srv, c;

const visit = (path, body) => fetch(srv.base + path, { method: "POST", headers: { "content-type": "application/json", origin: srv.base }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

before(async () => {
  srv = await startServer({ port: 8200, setupToken: TOKEN, extra: "'limits'=>['orders_per_hour'=>1000,'messages_per_hour'=>1000]" });
  c = client(srv.base);
  await c.state();
  await c.call("POST", "/api/auth/setup", { token: TOKEN, email: "owner@example.com", password: "three purple running shoes" });
  await enrol(c);
  // a priced, tracked product, an upcoming event, then publish
  const shop = (await c.call("GET", "/api/admin/content/shop")).json;
  const sd = structuredClone(shop.doc);
  Object.assign(sd.categories[0].items.find((p) => p.id === "sotr-cap"), { price: 10, stock: 2 });
  Object.assign(sd.categories[0].items.find((p) => p.id === "sotr-tee"), { price: 25, stock: { S: 9, M: 1, L: 9, XL: 9 } });
  await c.call("PUT", "/api/admin/content/shop", { doc: sd, rev: shop.rev });
  const runs = (await c.call("GET", "/api/admin/content/runs")).json;
  const rd = structuredClone(runs.doc);
  rd.events.push({ id: "future-run", kind: "run", title: "Future run", starts: "2031-01-01T18:30", ends: "2031-01-01T19:30", place: "Biel", detail: "", note: "", featured: false, spots: 8 });
  await c.call("PUT", "/api/admin/content/runs", { doc: rd, rev: runs.rev });
  await c.call("POST", "/api/admin/publish", { note: "phase 4 test" });
  await visit("/api/orders", { name: "Nour Haddad", phone: "+961 70 123 456", governorate: "Beirut", address: "Hamra, Bliss Street 4", payment_method: "cod", items: [{ id: "sotr-cap", option: "", qty: 1 }] });
  await visit("/api/messages", { name: "Rania Haddad", email: "rania@example.com", about: "general", message: "Hello there, a question." });
});
after(() => srv?.stop());

test("the dashboard numbers: new orders, unread messages, upcoming events, low stock, recent orders", async () => {
  const o = (await c.call("GET", "/api/admin/overview")).json;
  assert.equal(o.orders.new, 1);
  assert.equal(o.messages.unread, 1);
  const titles = o.events.map((e) => e.title);
  assert.ok(titles.includes("Future run"), titles.join());
  assert.ok(!o.events.some((e) => e.starts.startsWith("2026-09-2")), "events that already ended are left out");
  assert.deepEqual(o.events.map((e) => e.starts), [...o.events.map((e) => e.starts)].sort(), "soonest first");
  assert.equal(o.events.find((e) => e.title === "Future run").spots, 8);
  const low = o.low_stock.map((l) => `${l.name}|${l.option}|${l.left}`);
  assert.ok(low.includes("SheOnTheRun Cap||1"), low.join());
  assert.ok(low.includes("SheOnTheRun Tee|M|1"), low.join());
  assert.ok(!low.some((l) => l.includes("|S|")), "plentiful sizes aren't listed");
  assert.equal(o.recent_orders[0].name, "Nour Haddad");
  assert.equal(o.last_backup, null);
  const anon = client(srv.base);
  await anon.state();
  assert.equal((await anon.call("GET", "/api/admin/overview")).status, 401);
  assert.equal((await anon.call("GET", "/api/admin/activity")).status, 401);
  assert.equal((await anon.text("/api/admin/backup")).status, 401);
});

test("the activity log says who did what, in plain words", async () => {
  const a = (await c.call("GET", "/api/admin/activity")).json;
  const lines = a.items.map((i) => i.what);
  assert.ok(lines.some((l) => l.startsWith("Published the website")), lines.join(" | "));
  assert.ok(lines.some((l) => l === "Turned on 2-step sign-in"));
  assert.ok(lines.some((l) => l.startsWith("Saved a draft of: shop")));
  assert.equal(a.items.find((i) => i.what.startsWith("Published")).who, "owner@example.com");
  assert.ok(a.total >= 5);
});

test("download backup: has content, orders and messages — and no secrets", async () => {
  const r = await c.text("/api/admin/backup");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-disposition"), /sheontherun-backup-\d{4}-\d{2}-\d{2}\.json/);
  const b = JSON.parse(r.text);
  assert.equal(b.orders.length, 1);
  assert.equal(b.orders[0].customer_name, "Nour Haddad");
  assert.equal(b.messages.length, 1);
  assert.equal(b.content.shop.doc.categories[0].items.find((p) => p.id === "sotr-tee").price, 25);
  assert.ok(b.content.posts && b.content.gallery && b.content.images);
  assert.deepEqual(b.admins.map((a) => a.email), ["owner@example.com"]);
  for (const secret of ["password_hash", "totp_secret", "code_hash", "$argon2", "$2y$"]) {
    assert.ok(!r.text.includes(secret), `the backup must not contain ${secret}`);
  }
  const act = (await c.call("GET", "/api/admin/activity")).json.items.map((i) => i.what);
  assert.ok(act.includes("Downloaded a backup"));
});

test("the nightly job writes a private backup file and keeps only the newest 14", () => {
  const dir = mkdtempSync(join(tmpdir(), "sotr-bk-"));
  try {
    for (let d = 1; d <= 16; d++) writeFileSync(join(dir, `sotr-backup-2020-01-${String(d).padStart(2, "0")}.json`), "{}");
    const [php, args] = phpCommand();
    const run = spawnSync(php, [...args, join(root, "server", "bin", "backup.php"), dir], { encoding: "utf8", env: { ...process.env, SOTR_CONFIG: srv.config } });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /Backup written/);
    const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    assert.equal(files.length, 14);
    assert.ok(!files.includes("sotr-backup-2020-01-01.json"), "oldest removed");
    const today = files.find((f) => !f.startsWith("sotr-backup-2020"));
    assert.ok(today, "today's file exists");
    assert.equal(JSON.parse(readFileSync(join(dir, today), "utf8")).orders.length, 1);
    assert.ok(existsSync(join(dir, ".htaccess")), "the folder is closed to the web");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
