/* =============================================================================
   EXPORT CONTENT FOR THE ADMIN PANEL  —  run by hand, once per seed refresh
   -----------------------------------------------------------------------------
   Reads today's hand-written data files and writes server/database/seed/content.json,
   which the admin backend imports into its database the first time it runs.
   Each item carries its Arabic words inline (item.ar = {...}) instead of in a
   separate file matched by id, so the editor can show English | العربية side by side.

   Usage:  node tools/export-content.mjs
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function loadDataFiles(dir = join(root, "data")) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of ["config", "products", "runs", "packages", "testimonials", "ar", "images", "posts", "gallery"]) {
    vm.runInContext(readFileSync(join(dir, f + ".js"), "utf8"), sandbox, { filename: f + ".js" });
  }
  // Plain JSON copy, so nothing from the VM context leaks out.
  return JSON.parse(JSON.stringify(sandbox.window));
}

const withAr = (obj, ar) => (ar && Object.keys(ar).length ? { ...obj, ar } : { ...obj });

export function buildSeed(w) {
  const A = w.SITE_AR || {};
  const S = w.SITE_SHOP, R = w.SITE_RUNS, O = w.SITE_OFFER;
  const sh = A.shop || {};

  const shop = {
    categories: S.categories.map((c) => ({
      ...withAr(c, (sh.categories || {})[c.id]),
      items: (c.items || []).map((p) => withAr(p, (sh.items || {})[p.id])),
    })),
    governorates: S.governorates,
    ...(A.governorates ? { ar: { governorates: A.governorates } } : {}),
  };

  const runs = {
    recurring: withAr(R.recurring, A.recurring),
    events: R.events.map((e) => withAr(e, (A.events || {})[e.id])),
  };

  const offer = {
    ...O,
    services: O.services.map((s) => withAr(s, (A.services || {})[s.id])),
    packages: O.packages.map((p) => withAr(p, (A.packages || {})[p.id])),
    challenge: withAr(O.challenge, A.challenge),
    ...(A.fit ? { ar: { fit: A.fit } } : {}),
  };

  const testimonials = { items: w.SITE_TESTIMONIALS };
  const settings = { ...w.SITE };

  // Arabic the panel doesn't edit item-by-item (publications and topics stay carried through untouched).
  const extras = { ar: {} };
  for (const k of ["publications", "topics"]) if (A[k] !== undefined) extras.ar[k] = A[k];

  // Photos: everything the site needs to draw them, plus an Arabic alt-text slot.
  const images = {
    items: Object.entries(w.SITE_IMAGES || {}).map(([name, v]) => ({
      name, alt: v.alt || "", w: v.w, r: v.r, seeded: true,
    })),
  };

  // Gallery runs: Arabic captions are matched by photo name today; move each onto its item.
  const gallery = {};
  for (const run of ["community", "fieldwork"]) {
    gallery[run] = (w.SITE_GALLERY[run] || []).map((g) => withAr({ ...g }, (A.gallery || {})[g.img] ? { caption: A.gallery[g.img] } : null));
  }

  // Journal: today's two articles, with the body and search wording read from their own pages.
  const posts = {
    items: (w.SITE_POSTS || []).map((p) => {
      const html = readFileSync(join(root, "journal", p.slug + ".html"), "utf8").split("\r\n").join("\n");
      const body = (/<div class="prose mt-l">\n([\s\S]*?)\n        <\/div>\n\n        <div class="discovery/.exec(html) || [, ""])[1];
      const unesc = (t) => t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      const seoTitle = unesc((/<title>([\s\S]*?)<\/title>/.exec(html) || [, ""])[1]);
      const seoDesc = unesc((/<meta name="description" content="([^"]*)"/.exec(html) || [, ""])[1]);
      const ar = (A.posts || {})[p.slug];
      return withAr({
        slug: p.slug, title: p.title, kicker: p.kicker, date: p.date, readingTime: p.readingTime, excerpt: p.excerpt,
        image: p.image, draft: !!p.draft, seoTitle, seoDescription: seoDesc,
        bodyHtml: body.split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n").trim(),
      }, ar);
    }),
  };

  return { version: 1, areas: { shop, runs, offer, testimonials, settings, extras, images, posts, gallery } };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("export-content.mjs")) {
  const seed = buildSeed(loadDataFiles());
  const out = join(root, "server", "database", "seed", "content.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(seed, null, 2) + "\n");
  const a = seed.areas;
  console.log(`Wrote ${out}`);
  console.log(`  products: ${a.shop.categories.reduce((n, c) => n + c.items.length, 0)} in ${a.shop.categories.length} categories`);
  console.log(`  events: ${a.runs.events.length} · services: ${a.offer.services.length} · packages: ${a.offer.packages.length}`);
  console.log(`  testimonials: ${a.testimonials.items.length} · photos: ${a.images.items.length} · articles: ${a.posts.items.length}`);
}
