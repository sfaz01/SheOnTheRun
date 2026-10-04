/* The meal-plan library: uploads, the sample choice (draft → Publish), delete guards.
     node --test server/tests/plans.test.mjs */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { startServer, client, enrol } from "./helpers.mjs";

const TOKEN = "plans-test-token-0123456789";
let srv, c;

const planHtml = (word) => Buffer.from(`<!doctype html><html><body><div>${word}</div><script>window.storage;</script></body></html>`);
const planCsv = (word) => Buffer.from(`meal,guide,option,kcal\nBreakfast,300 kcal,${word},300\n`);
const file = (name, bytes, type) => ({ name, bytes, type });

before(async () => {
  srv = await startServer({ port: 8202, setupToken: TOKEN });
  c = client(srv.base);
  await c.state();
  await c.call("POST", "/api/auth/setup", { token: TOKEN, email: "owner@example.com", password: "three purple running shoes" });
  await enrol(c);
});
after(() => srv?.stop());

const inLibrary = (name) => join(srv.site, "data", "plans", name);
const up = (fields, f) => c.upload("/api/admin/plans/upload", fields, f);

test("the library needs a signed-in admin", async () => {
  const anon = client(srv.base);
  await anon.state();
  assert.equal((await anon.call("GET", "/api/admin/plans")).status, 401);
  assert.equal((await anon.upload("/api/admin/plans/upload", {}, file("x.html", planHtml("x"), "text/html"))).status, 401);
});

test("uploads plan pages and spreadsheets, and refuses files that aren't plans", async () => {
  assert.equal((await up({ name: "plan-a" }, file("plan-a.html", planHtml("Plan A"), "text/html"))).status, 201);
  assert.ok(existsSync(inLibrary("plan-a.html")));
  assert.match(readFileSync(inLibrary("plan-a.html"), "utf8"), /Plan A/);

  assert.equal((await up({ name: "plan-b" }, file("plan-b.html", planHtml("Plan B"), "text/html"))).status, 201);
  const csv = await up({}, file("Week 1 Plan.csv", planCsv("oats"), "text/csv"));
  assert.equal(csv.status, 201, JSON.stringify(csv.json));
  assert.equal(csv.json.name, "week-1-plan.csv", "the file's own name is made safe");
  assert.ok(existsSync(inLibrary("week-1-plan.csv")));

  assert.equal((await up({}, file("evil.php", Buffer.from("<?php echo 1;"), "application/x-php"))).status, 422);
  assert.equal((await up({}, file("server.html", Buffer.from("<?php echo 1; ?><div>x</div>"), "text/html"))).status, 422);
  assert.equal((await up({}, file("notes.csv", Buffer.from("no commas here"), "text/csv"))).status, 422);
  assert.equal((await up({}, file("bad.json", Buffer.from("{not json"), "application/json"))).status, 422);
  assert.equal((await up({ name: "plan-a" }, file("again.html", planHtml("Again"), "text/html"))).status, 409, "no silent overwrite");
});

test("the library lists files, and choosing the sample goes live only on Publish", async () => {
  let l = (await c.call("GET", "/api/admin/plans")).json;
  let names = l.files.map((f) => f.name);
  assert.ok(names.includes("plan-a.html") && names.includes("plan-b.html") && names.includes("week-1-plan.csv"), names.join());
  assert.equal(l.sample, "fatimas-plate.html", "the built-in default until she changes it");
  assert.ok(l.files.find((f) => f.name === "plan-a.html").canDelete);

  // First publish writes the default sample into data/plan.js.
  assert.equal((await c.call("POST", "/api/admin/publish", { note: "plans" })).status, 200);
  assert.match(readFileSync(join(srv.site, "data", "plan.js"), "utf8"), /fatimas-plate\.html/);

  assert.equal((await c.call("POST", "/api/admin/plans/sample", { name: "plan-a.html" })).status, 200);
  assert.equal((await c.call("GET", "/api/admin/status")).json.changed.plans, true, "the choice is a draft until published");

  // The preview shows it straight away; the live file still has the old sample.
  assert.match((await c.text("/api/preview/data/plan.js")).text, /plan-a\.html/);
  assert.match(readFileSync(join(srv.site, "data", "plan.js"), "utf8"), /fatimas-plate\.html/);

  assert.equal((await c.call("POST", "/api/admin/publish", { note: "" })).status, 200);
  const live = readFileSync(join(srv.site, "data", "plan.js"), "utf8");
  assert.match(live, /plan-a\.html/);
  assert.match(live, /meal-plan-template\.csv/);
});

test("delete guards: the sample and the built-in template stay; other files go", async () => {
  assert.equal((await c.call("DELETE", "/api/admin/plans/plan-a.html")).status, 409, "it is the sample");
  assert.equal((await c.call("DELETE", "/api/admin/plans/meal-plan-template.csv")).status, 409, "the site hands it out");
  assert.equal((await c.call("DELETE", "/api/admin/plans/never-existed.html")).status, 404);

  assert.equal((await c.call("POST", "/api/admin/plans/sample", { name: "plan-b.html" })).status, 200);
  assert.equal((await c.call("DELETE", "/api/admin/plans/plan-a.html")).status, 200);
  assert.ok(!existsSync(inLibrary("plan-a.html")));
  assert.equal((await c.call("DELETE", "/api/admin/plans/plan-a.html")).status, 404);
});

test("the activity log explains plan changes in plain words", async () => {
  const a = (await c.call("GET", "/api/admin/activity")).json;
  const lines = a.items.map((i) => i.what);
  assert.ok(lines.some((l) => l.startsWith("Uploaded a plan file")), lines.join(" | "));
  assert.ok(lines.includes("Changed the sample plan: plan-b.html"), lines.join(" | "));
  assert.ok(lines.includes("Deleted a plan file: plan-a.html"), lines.join(" | "));
});
