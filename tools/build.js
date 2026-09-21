/* =============================================================================
   DEPLOY-TIME EXTRAS  —  run by the GitHub Action, never by hand
   -----------------------------------------------------------------------------
   Reads data/posts.js and writes, into the folder that gets published:
     feed.xml     the Journal as RSS, so readers and apps can follow it
     sitemap.xml  every page plus every published article, for search engines
   Publishing a new article therefore only means editing posts.js — both files
   follow on the next deploy.

   Usage:  node tools/build.js _site
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const OUT = process.argv[2] || "_site";
const ROOT = path.join(__dirname, "..");
const SITE_URL = "https://sheontherun.com/";

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "data/posts.js"), "utf8"), sandbox);
const posts = (sandbox.window.SITE_POSTS || [])
  .filter((p) => !p.draft)
  .sort((a, b) => String(b.date).localeCompare(String(a.date)));

const x = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------------------------------------------------------------- feed.xml */
const items = posts.map((p) => {
  const url = SITE_URL + "journal/" + p.slug + ".html";
  return `    <item>
      <title>${x(p.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <category>${x(p.kicker)}</category>
      <pubDate>${new Date(p.date + "T08:00:00+03:00").toUTCString()}</pubDate>
      <description>${x(p.excerpt)}</description>
    </item>`;
}).join("\n");

fs.writeFileSync(path.join(OUT, "feed.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Journal — Fatima Mouzahem</title>
    <link>${SITE_URL}journal/</link>
    <atom:link href="${SITE_URL}feed.xml" rel="self" type="application/rss+xml"/>
    <description>Nutrition, running and everyday wellbeing — from a licensed dietitian and sports nutritionist in Beirut.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`);

/* ------------------------------------------------------------- sitemap.xml */
const pages = [
  ["", "1.0"], ["dietontherun.html", "0.9"], ["about.html", "0.8"],
  ["sheontherun.html", "0.8"], ["public-health.html", "0.8"], ["shop.html", "0.7"],
  ["connect.html", "0.7"], ["journal/", "0.6"], ["ar/", "0.7"]
];
const urls = pages.map(([p, pr]) => `  <url><loc>${SITE_URL}${p}</loc><priority>${pr}</priority></url>`)
  .concat(posts.map((p) =>
    `  <url><loc>${SITE_URL}journal/${p.slug}.html</loc><lastmod>${p.date}</lastmod><priority>0.5</priority></url>`));

fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`);

console.log(`feed.xml: ${posts.length} article(s) · sitemap.xml: ${urls.length} URL(s)`);
