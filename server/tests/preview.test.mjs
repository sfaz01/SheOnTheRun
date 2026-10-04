/* Preview: see the saved drafts on the real pages without publishing, and without
   touching a single live file.
     node --test server/tests/preview.test.mjs */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer, client, enrol } from "./helpers.mjs";

const TOKEN = "preview-test-token-0123456789";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
let srv, c;

before(async () => {
  srv = await startServer({ port: 8201, setupToken: TOKEN });
  c = client(srv.base);
  await c.state();
  await c.call("POST", "/api/auth/setup", { token: TOKEN, email: "owner@example.com", password: "three purple running shoes" });
  await enrol(c);
});
after(() => srv?.stop());

test("preview needs a signed-in admin", async () => {
  const anon = client(srv.base);
  await anon.state();
  assert.equal((await anon.text("/api/preview/page?p=index.html")).status, 401);
  assert.equal((await anon.text("/api/preview/data/config.js")).status, 401);
  assert.equal((await anon.text("/api/preview/data/nope.js")).status, 401, "even made-up files are refused before login");
});

test("the preview page is the real page, wired to the draft data and to itself", async () => {
  const r = await c.text("/api/preview/page?p=shop.html");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") || "", /text\/html/);
  assert.match(r.text, /<base href="\/">/, "relative assets resolve from the site root");
  assert.match(r.text, /src="\/api\/preview\/data\/config\.js"/, "config comes from the drafts");
  assert.match(r.text, /src="\/api\/preview\/data\/products\.js"/, "the shop comes from the drafts");
  assert.match(r.text, /assets\/js\/site\.js/, "the site's own scripts still load");
  assert.ok(r.text.includes("/api/preview/page?p="), "internal links stay in the preview");
  const left = r.text.match(/href="(?!https?:|#|mailto:|tel:|\/api\/preview\/)[^"]*\.html[^"]*"/g) || [];
  assert.deepEqual(left, [], "every site page link was rewritten: " + left.join(", "));
});

test("Arabic pages preview too, with the right base", async () => {
  const r = await c.text("/api/preview/page?p=ar%2Fabout.html");
  assert.equal(r.status, 200);
  assert.match(r.text, /<base href="\/ar\/">/);
  assert.match(r.text, /src="\/api\/preview\/data\/config\.js"/);
});

test("the data endpoint generates from the saved drafts and never writes a live file", async () => {
  const live = resolve(root, "data", "config.js");
  const before = readFileSync(live, "utf8");

  const settings = (await c.call("GET", "/api/admin/content/settings")).json;
  const doc = structuredClone(settings.doc);
  doc.instagramHandle = "@preview-only-check";
  const saved = await c.call("PUT", "/api/admin/content/settings", { doc, rev: settings.rev });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));

  const p = await c.text("/api/preview/data/config.js");
  assert.equal(p.status, 200);
  assert.match(p.headers.get("content-type") || "", /javascript/);
  assert.match(p.text, /@preview-only-check/, "preview shows the unpublished change");
  assert.equal(readFileSync(live, "utf8"), before, "the live data file is untouched");
});

test("a draft article has a real preview page, and the live one does not exist", async () => {
  assert.ok(!existsSync(resolve(root, "journal", "preview-draft-post.html")), "nothing live under this slug");

  const posts = (await c.call("GET", "/api/admin/content/posts")).json;
  const doc = structuredClone(posts.doc);
  doc.items.push({
    slug: "preview-draft-post", title: "A draft to preview", kicker: "Testing", date: "2026-10-04",
    readingTime: "2 min", excerpt: "Only in the preview.", bodyHtml: "<p>The draft body.</p>", draft: true,
  });
  const saved = await c.call("PUT", "/api/admin/content/posts", { doc, rev: posts.rev });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));

  const r = await c.text("/api/preview/page?p=journal%2Fpreview-draft-post.html");
  assert.equal(r.status, 200);
  assert.match(r.text, /A draft to preview/);
  assert.match(r.text, /The draft body\./);
  assert.ok(!existsSync(resolve(root, "journal", "preview-draft-post.html")), "preview still writes nothing");
});

test("preview refuses paths that aren't website pages", async () => {
  const cases = ["", "../server/app/bootstrap.php", "server/app/bootstrap.php", "config.php", "data/products.js", "index.html/../server/config.php"];
  for (const p of cases) {
    const r = await c.text("/api/preview/page?p=" + encodeURIComponent(p));
    assert.notEqual(r.status, 200, `“${p}” must not preview`);
    assert.ok(r.status === 400 || r.status === 404, `“${p}” got ${r.status}`);
  }
  assert.equal((await c.text("/api/preview/data/../config.js")).status, 404);
  assert.equal((await c.text("/api/preview/data/nope.js")).status, 404, "only the generator's own files are served");
  const plan = await c.text("/api/preview/data/plan.js");
  assert.equal(plan.status, 200);
  assert.match(plan.text, /fatimas-plate\.html/, "the sample plan default is part of the preview data");
});
