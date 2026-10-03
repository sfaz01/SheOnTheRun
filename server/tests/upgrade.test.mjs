/* The live site's database was created in phase 1, before Journal/gallery/photos existed.
   This rebuilds that exact shape and checks the upgrade is seamless.
     node --test server/tests/upgrade.test.mjs */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { startServer, client, enrol } from "./helpers.mjs";

const TOKEN = "upgrade-test-token-0123456789";
let srv, c;

before(async () => {
  srv = await startServer({ port: 8196, setupToken: TOKEN });
  c = client(srv.base);
  await c.state();
  await c.call("POST", "/api/auth/setup", { token: TOKEN, email: "owner@example.com", password: "three purple running shoes" });
  await enrol(c);
  await c.call("GET", "/api/admin/status"); // seeds everything

  // Turn the database back into a phase 1 one.
  const db = new DatabaseSync(srv.db);
  db.exec("DELETE FROM content WHERE area IN ('posts','gallery')");
  db.prepare("UPDATE content SET doc = ? WHERE area = 'images'").run(JSON.stringify({ items: [{ name: "about-armchair", alt: "Fatima seated" }] }));
  const extras = JSON.parse(db.prepare("SELECT doc FROM content WHERE area='extras'").get().doc);
  extras.ar.posts = { old: 1 }; extras.ar.gallery = { old: 1 };
  db.prepare("UPDATE content SET doc = ? WHERE area = 'extras'").run(JSON.stringify(extras));
  const snap = JSON.parse(db.prepare("SELECT snapshot FROM publishes ORDER BY id DESC LIMIT 1").get().snapshot);
  for (const k of ["posts", "gallery", "images"]) delete snap[k];
  snap.extras = extras;
  db.prepare("UPDATE publishes SET snapshot = ? WHERE id = (SELECT MAX(id) FROM publishes)").run(JSON.stringify(snap));
  db.close();
});
after(() => srv?.stop());

test("the first request after upgrading adds the new areas without claiming any unpublished change", async () => {
  const photos = (await c.call("GET", "/api/admin/photos")).json.photos;
  assert.equal(photos.length, 94, "the photo list is rebuilt with sizes and shapes");
  assert.deepEqual(photos.find((p) => p.name === "about-armchair").w, [480, 748]);

  const st = (await c.call("GET", "/api/admin/status")).json;
  assert.ok(Object.values(st.changed).every((v) => v === false), JSON.stringify(st.changed));

  const posts = (await c.call("GET", "/api/admin/content/posts")).json.doc.items;
  assert.equal(posts.length, 2);
  assert.equal((await c.call("GET", "/api/admin/content/gallery")).json.doc.community.length, 8);

  // old Arabic leftovers no longer override the per-item Arabic
  assert.equal((await c.call("GET", "/api/admin/content/extras")).json.doc.ar.posts, undefined);
});

test("upgrading twice changes nothing", async () => {
  const a = (await c.call("GET", "/api/admin/content/posts")).json;
  await c.call("GET", "/api/admin/photos");
  const b = (await c.call("GET", "/api/admin/content/posts")).json;
  assert.equal(a.rev, b.rev);
});
