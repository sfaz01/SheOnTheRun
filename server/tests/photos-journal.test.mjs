/* Phase 2 end-to-end: photo library (upload/resize/replace/delete), galleries, and the Journal
   (rich text is sanitised, publishing writes and removes real pages, feed and sitemap).
     node --test server/tests/photos-journal.test.mjs */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { startServer, client, enrol, makePng } from "./helpers.mjs";

const TOKEN = "photo-test-token-0123456789";
let srv, c;

const img = (f) => join(srv.site, "public", "images", f);
const live = (rel) => readFileSync(join(srv.site, rel), "utf8");
function liveData(file, global) {
  const box = { window: {} };
  vm.runInNewContext(live("data/" + file), box);
  return JSON.parse(JSON.stringify(box.window[global]));
}
const png = async (w, h, name = "pic.png") => ({ bytes: await makePng(w, h), type: "image/png", name });

before(async () => {
  srv = await startServer({ port: 8195, setupToken: TOKEN });
  c = client(srv.base);
  await c.state();
  assert.equal((await c.call("POST", "/api/auth/setup", { token: TOKEN, email: "owner@example.com", password: "three purple running shoes" })).status, 200);
  await enrol(c);
});
after(() => srv?.stop());

test("the schema offers Journal and galleries to the generic editor, and photos are managed separately", async () => {
  const s = (await c.call("GET", "/api/admin/schema")).json;
  assert.ok(s.areas.posts && s.areas.gallery);
  assert.equal(s.areas.images, undefined);
  const imagesSave = await c.call("PUT", "/api/admin/content/images", { doc: { items: [] }, rev: 1 });
  assert.equal(imagesSave.status, 404, "the photo list can only change through the photo tools");
});

test("an existing site gains the new areas on first use, with nothing waiting to publish", async () => {
  const st = (await c.call("GET", "/api/admin/status")).json;
  assert.ok(Object.values(st.changed).every((v) => v === false), JSON.stringify(st.changed));
  const photos = (await c.call("GET", "/api/admin/photos")).json.photos;
  assert.equal(photos.length, 94);
  assert.ok(photos.every((p) => p.canDelete === false), "photos built into the pages can't be deleted");
  const posts = (await c.call("GET", "/api/admin/content/posts")).json.doc.items;
  assert.deepEqual(posts.map((p) => p.slug), ["a-month-in-shanghai", "fuelling-your-first-10k"]);
  assert.match(posts[0].bodyHtml, /^<p>In 2025 I travelled/);
});

test("upload: resized to the site's widths in WebP and JPEG, never bigger than the original", async () => {
  const r = await c.upload("/api/admin/photos", { name: "Test Photo", alt: "A gradient test image", alt_ar: "صورة اختبار" }, await png(1200, 800));
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.name, "test-photo");
  assert.deepEqual(r.json.w, [480, 960], "1200px wide: no 1440/2000 versions");
  assert.equal(r.json.r, 1.5);
  for (const f of ["test-photo-480.jpg", "test-photo-480.webp", "test-photo-960.jpg", "test-photo-960.webp"]) assert.ok(existsSync(img(f)), f);
  assert.ok(!existsSync(img("test-photo-1440.jpg")));
  const list = (await c.call("GET", "/api/admin/photos")).json.photos.find((p) => p.name === "test-photo");
  assert.equal(list.alt, "A gradient test image");
  assert.equal(list.altAr, "صورة اختبار");
  assert.equal(list.canDelete, true);
  const st = (await c.call("GET", "/api/admin/status")).json;
  assert.equal(st.changed.images, true, "the new photo's details wait for Publish");
});

test("upload is refused for a taken name, a missing description, a non-image and a missing CSRF token", async () => {
  assert.equal((await c.upload("/api/admin/photos", { name: "test-photo", alt: "dup" }, await png(300, 300))).status, 409);
  assert.equal((await c.upload("/api/admin/photos", { name: "no-alt", alt: "" }, await png(300, 300))).status, 422);
  const notImage = await c.upload("/api/admin/photos", { name: "fake", alt: "fake" }, { bytes: Buffer.from("<?php echo 1; ?>"), type: "image/png", name: "fake.png" });
  assert.equal(notImage.status, 422);
  assert.ok(!existsSync(img("fake-480.jpg")));
  const tiny = await c.upload("/api/admin/photos", { name: "tiny", alt: "tiny" }, await png(50, 50));
  assert.equal(tiny.status, 422);
  const anon = client(srv.base);
  await anon.state();
  assert.equal((await anon.upload("/api/admin/photos", { name: "x", alt: "x" }, await png(300, 300))).status, 401);
});

test("a photo smaller than 480px wide keeps its own size", async () => {
  const r = await c.upload("/api/admin/photos", { name: "small-one", alt: "small" }, await png(300, 300));
  assert.equal(r.status, 201);
  assert.deepEqual(r.json.w, [300]);
});

test("edit the description, replace the file (same name, new widths), then publish writes images.js", async () => {
  const u = await c.call("PUT", "/api/admin/photos/test-photo", { alt: "Better description", alt_ar: "" });
  assert.equal(u.status, 200);
  assert.equal(u.json.ar, undefined);
  const rep = await c.upload("/api/admin/photos", { replace: "test-photo", alt: "Better description", alt_ar: "وصف أفضل" }, await png(2600, 1300));
  assert.equal(rep.status, 201);
  assert.deepEqual(rep.json.w, [480, 960, 1440, 2000]);
  assert.ok(existsSync(img("test-photo-2000.jpg")));

  assert.equal((await c.call("POST", "/api/admin/publish", { note: "photos" })).status, 200);
  const data = liveData("images.js", "SITE_IMAGES");
  assert.deepEqual(data["test-photo"], { w: [480, 960, 1440, 2000], r: 2, alt: "Better description", altAr: "وصف أفضل" });
  assert.equal(Object.keys(data).length, 96, "94 original + 2 new");
  assert.equal(data["about-armchair"].alt.startsWith("Fatima seated"), true, "original photos untouched");
});

test("a photo in use can't be deleted; built-in photos can't be deleted; an unused upload can", async () => {
  const shop = (await c.call("GET", "/api/admin/content/shop")).json;
  const doc = structuredClone(shop.doc);
  doc.categories[0].items[0].image = "test-photo";
  assert.equal((await c.call("PUT", "/api/admin/content/shop", { doc, rev: shop.rev })).status, 200);
  const inUse = await c.call("DELETE", "/api/admin/photos/test-photo");
  assert.equal(inUse.status, 409);
  assert.match(inUse.json.error, /SheOnTheRun Tee/);

  assert.equal((await c.call("DELETE", "/api/admin/photos/about-armchair")).json.code, "builtin");

  const del = await c.call("DELETE", "/api/admin/photos/small-one");
  assert.equal(del.status, 200);
  assert.ok(!existsSync(img("small-one-300.jpg")));
});

test("the gallery editor saves captions in both languages and publish writes gallery.js and the Arabic captions", async () => {
  const g = (await c.call("GET", "/api/admin/content/gallery")).json;
  assert.equal(g.doc.community.length, 8);
  assert.equal(g.doc.community[0].ar.caption, "يوم السباق، معاً");
  const doc = structuredClone(g.doc);
  doc.community.unshift({ img: "test-photo", caption: "Test caption", ar: { caption: "تعليق" } });
  assert.equal((await c.call("PUT", "/api/admin/content/gallery", { doc, rev: g.rev })).status, 200);
  await c.call("POST", "/api/admin/publish", { note: "gallery" });
  const pub = liveData("gallery.js", "SITE_GALLERY");
  assert.deepEqual(pub.community[0], { img: "test-photo", caption: "Test caption" });
  assert.equal(pub.community.length, 9);
  assert.equal(liveData("ar.js", "SITE_AR").gallery["test-photo"], "تعليق");
});

const nasty = '<p>Hello <strong onclick="x()">world</strong></p><script>alert(1)</script><h1>Big</h1>'
  + '<p><a href="javascript:alert(1)">bad link</a> <a href="https://example.com/a?b=1&c=2" target="_blank" onmouseover="y()">good link</a></p>'
  + '<img src=x onerror=alert(1)><iframe src="https://evil.example"></iframe><ul><li>one</li><li>two</li></ul>'
  + '<style>body{display:none}</style><p class="measured mt-l">small print</p><p class="evil">other class</p>loose text';

test("Journal: a new article is stored sanitised and validated", async () => {
  const posts = (await c.call("GET", "/api/admin/content/posts")).json;
  const doc = structuredClone(posts.doc);
  doc.items.unshift({ slug: "", title: "Post-run smoothies!", kicker: "Recipes", date: "2026-10-05", readingTime: "4 min", excerpt: "Three easy blends.", image: "test-photo", draft: false, bodyHtml: nasty, ar: { title: "عصائر ما بعد الجري" } });

  // missing cover photo / empty body are refused for a published article
  const bad = structuredClone(doc);
  bad.items[0].image = ""; bad.items[0].bodyHtml = "<p></p>";
  const r1 = await c.call("PUT", "/api/admin/content/posts", { doc: bad, rev: posts.rev });
  assert.equal(r1.status, 422);
  const paths = r1.json.errors.map((e) => e.path);
  assert.ok(paths.includes("items.0.image") && paths.includes("items.0.bodyHtml"), paths.join());

  const dup = structuredClone(doc);
  dup.items[0].slug = "fuelling-your-first-10k";
  assert.equal((await c.call("PUT", "/api/admin/content/posts", { doc: dup, rev: posts.rev })).status, 422);

  doc.items[0].slug = "post-run-smoothies";
  const ok = await c.call("PUT", "/api/admin/content/posts", { doc, rev: posts.rev });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  const body = ok.json.doc.items[0].bodyHtml;
  for (const bad of ["<script", "alert(1)", "onclick", "javascript:", "<img", "<iframe", "<style", "display:none", "onmouseover", "class=\"evil\"", "<h1"]) {
    assert.ok(!body.includes(bad), `sanitised body still contains ${bad}:\n${body}`);
  }
  assert.ok(body.includes("<strong>world</strong>") && body.includes("<h2>Big</h2>") && body.includes("<li>two</li>"));
  assert.ok(body.includes('<a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer">good link</a>'), body);
  assert.ok(body.includes("bad link") && !body.includes('href="javascript'), "the words of a refused link survive");
  assert.ok(body.includes('<p class="measured mt-l">small print</p>') && body.includes("<p>other class</p>") && body.includes("<p>loose text</p>"));
});

test("Journal: publishing writes the page, the list, the feed and the sitemap — and nothing from a draft", async () => {
  await c.call("POST", "/api/admin/publish", { note: "article" });
  const page = live("journal/post-run-smoothies.html");
  assert.match(page, /<h1 class="page-title mt-s reveal in">Post-run smoothies!<\/h1>/);
  assert.match(page, /<p class="measured mt-m">Recipes · 5 Oct 2026 · 4 min<\/p>/);
  assert.match(page, /data-img="test-photo"/);
  assert.ok(!page.includes("{{") && !page.includes("<script>alert"), "no template leftovers or scripts");
  assert.match(page, /"datePublished": "2026-10-05"/);
  assert.ok(live("feed.xml").includes("journal/post-run-smoothies.html"));
  assert.ok(live("sitemap.xml").includes("journal/post-run-smoothies.html"));
  const list = liveData("posts.js", "SITE_POSTS");
  assert.equal(list[0].slug, "post-run-smoothies");
  assert.ok(!("bodyHtml" in list[0]) && !("seoTitle" in list[0]), "bodies stay out of the list");
  assert.equal(liveData("ar.js", "SITE_AR").posts["post-run-smoothies"].title, "عصائر ما بعد الجري");

  // Make it a draft: it must disappear from the list, feed, sitemap and the page itself
  const posts = (await c.call("GET", "/api/admin/content/posts")).json;
  const doc = structuredClone(posts.doc);
  doc.items[0].draft = true;
  assert.equal((await c.call("PUT", "/api/admin/content/posts", { doc, rev: posts.rev })).status, 200);
  assert.ok(existsSync(join(srv.site, "journal", "post-run-smoothies.html")), "saving a draft doesn't touch the live site");
  await c.call("POST", "/api/admin/publish", { note: "unpublish" });
  assert.ok(!existsSync(join(srv.site, "journal", "post-run-smoothies.html")));
  assert.ok(!live("feed.xml").includes("post-run-smoothies"));
  assert.ok(!liveData("posts.js", "SITE_POSTS").some((p) => p.slug === "post-run-smoothies"));
  assert.ok(existsSync(join(srv.site, "journal", "a-month-in-shanghai.html")), "the other articles stay");
});

test("history can restore the state before the article existed", async () => {
  const hist = (await c.call("GET", "/api/admin/history")).json.versions;
  const withArticle = hist.find((v) => v.note === "article");
  assert.equal((await c.call("POST", `/api/admin/history/${withArticle.id}/restore`, {})).status, 200);
  const posts = (await c.call("GET", "/api/admin/content/posts")).json.doc.items;
  assert.equal(posts[0].draft, false, "restored to the published article");
});
