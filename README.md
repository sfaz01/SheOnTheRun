# Fatima Mouzahem — personal website

Licensed dietitian · certified sports nutritionist · public health professional · founder of
SheOnTheRun. Beirut, Lebanon.

Plain HTML, one stylesheet, two scripts, and a handful of data files you edit yourself.
No build step, no framework, no npm. Upload the `site/` folder to any host (Netlify, Vercel,
Cloudflare Pages, GitHub Pages, or ordinary shared hosting) and it runs.

---

## 1. Before you launch — two things to fill in

Open **`site/data/config.js`** and replace the two placeholders:

```js
whatsapp: "[[WHATSAPP NUMBER]]",   →   whatsapp: "96170123456"
email:    "[[EMAIL]]",             →   email: "you@yourdomain.com"
```

The WhatsApp number is **digits only, full international format** — country code, no `+`,
no leading `0`. Lebanon is `961`.

The moment you save that, every booking button opens WhatsApp with the message already
written — naming the service or package and whether it's in person or online. Until then the
buttons still work: they send people to the Connect page with the right subject already
chosen, so nothing is ever broken.

Then check `instagram`, `linkedin` (leave `""` to hide it) and `location` in the same file.

---

## 2. Your photographs

**All 49 photos you sent are in and placed.** They were converted from HEIC, cropped for
each spot they appear in, and saved at four widths in two formats, so a phone downloads a
small file and a laptop downloads a sharp one.

They live in `site/public/images/` and are named `slot-width.format`, e.g.

```
hero-road-wide-480.webp    hero-road-wide-480.jpg
hero-road-wide-960.webp    hero-road-wide-960.jpg
hero-road-wide-1440.webp   hero-road-wide-1440.jpg
hero-road-wide-2000.webp   hero-road-wide-2000.jpg
```

**`site/data/images.js` is the index of all of them.** Every photo is listed once with its
alt text — the description a screen reader reads aloud and Google indexes. If a description
is wrong, fix it there and it's fixed everywhere that photo appears.

**To swap a photo:** replace the files for that slot, keeping the same names and sizes.
**To change where photos appear:** `site/data/gallery.js` holds the photo runs — the moving
strip on the home page, the pinned run on SheOnTheRun, the album, the public-health
fieldwork grid, the China set. Reorder the names, add one, remove one; the page follows.

A few spots still show a designed placeholder rather than a photo — the wellness tools and
My Picks products in the shop. They're waiting on product shots. Drop images in and list
them in `site/data/products.js` and the placeholders disappear.

---

## 3. What you edit, and where

Everything that changes lives in **`site/data/`**. Plain text files with instructions at the
top of each. You never need to touch the HTML.

| File | Controls |
| --- | --- |
| `config.js` | WhatsApp number, email, Instagram, location |
| `runs.js` | Runs, classes, events — **past dates disappear by themselves** |
| `packages.js` | Services, prices, packages, BackOnTheRun, the How-it-works steps |
| `products.js` | Shop categories and products |
| `testimonials.js` | Client quotes |
| `posts.js` | The Journal index |
| `publications.js` | Papers and research interests |
| `images.js` | Every photograph and its description |
| `gallery.js` | Which photos appear in which run |

**Runs hide themselves.** Each event has an `ends` date and time in **Beirut time**. Once
that passes, the event vanishes from the site wherever in the world the visitor is. The
weekly "Sunset runs, Tuesdays & Thursdays" block is separate and always shows.

**Modest activewear** is already in `products.js` as a Coming Soon panel. Add products to its
`items` list and set `comingSoon: false` and it becomes a normal category.

---

## 4. Two things to deal with before you go live

**Testimonials are samples.** The three quotes in `site/data/testimonials.js` are layout
samples — nobody said those words. They carry a visible amber *"Sample — replace before
launch"* label so they can't go live pretending to be real. Replace them and delete
`sample: true` from each. Or empty the list (`window.SITE_TESTIMONIALS = [];`) and the whole
section removes itself.

**The Journal article.** *Fuelling your first 10k* was drafted for you, not by you. The
advice follows standard sports-nutrition guidance, but it publishes under your licence and
your name — please read it and make it sound like you.

---

## 5. Run it locally

```bash
python serve.py
```

Then open <http://localhost:8091>. (`serve.py` is a tiny preview server that tells the
browser not to cache, so your edits always show up. `python -m http.server` works too, but
you'll sometimes need to force-refresh.)

While you're on your own machine you'll see a small bar at the bottom reminding you about
anything still unset in `config.js`. Visitors never see it.

---

## 6. The design, in short

**Concept — "The Measured and the Lived."** You're the most measured kind of athlete (the
400m: splits, lanes, hundredths) and also the person who went to Shanghai for a month out of
curiosity. Every page runs two registers side by side: *measured* (small, tracked-out,
tabular figures — years, prices, citations) and *lived* (large warm serif, real photographs,
air). Two motifs carry it, and both were already in your own logos: the **five lane stripes**
under the DietOnTheRun wordmark, used as dividers, and the **teal echo** behind the lavender
"SHE", used as an afterimage on key headlines.

**Type.** Fraunces for display — warm, high-contrast, a little bit fashion, never clinical.
Instrument Sans for everything else. Two families only; the restraint is the point.

**Colour.** Warm paper `#FCFBF9`, warm-black `#16151A`, sand `#F4F1EC`. Your teal→lavender
gradient is used as *light* — hairlines, edge washes, the echo — never as a fill or a purple
button. Public Health and the footer sit on deep teal-ink `#0E2026`.

**Every page opens on a photograph.** Full-bleed, with your name or the page's sentence over
it, and your credentials in white on the home page. The images carry the site; the text gets
out of their way.

---

## 7. Motion, and what it depends on

Three libraries, loaded from a CDN, used for movement only:

| Library | Does |
| --- | --- |
| **GSAP + ScrollTrigger** | Headline reveals, parallax, the pinned photo run, the timeline image column |
| **Lenis** | Smooth scrolling on desktop (skipped on touch, where the native feel is better) |

**Nothing on the site depends on them.** If the CDN is blocked, a script fails, or the
visitor has "reduce motion" turned on in their system settings, every page still shows every
word and every photograph — the movement simply doesn't happen. There is also a safety pass
that reveals any headline the animation didn't finish, so text can never be trapped behind an
effect.

The lightbox (tap a photo in an album to see it full size, arrow keys to move, Escape to
close) is written by hand — it's sixty lines, and a dependency would have cost more than it
saved.

---

## 8. Files

| Path | What it is |
| --- | --- |
| `site/index.html` | Home — the road portrait, credentials, the four areas |
| `site/about.html` | About me — The Human / The Professional Me / 2014→2026 |
| `site/dietontherun.html` | The practice — approach, services, packages, challenge, journal |
| `site/sheontherun.html` | The community — story, pinned photo run, calendar, album |
| `site/public-health.html` | Consulting — expertise, fieldwork, the path, publications |
| `site/shop.html` | Shop — categories, products, WhatsApp ordering |
| `site/connect.html` | Connect — interest selector, form, direct routes |
| `site/journal/` | The Journal — index and articles |
| `site/data/` | **Everything you edit** |
| `site/public/images/` | **Your photographs**, at four widths each |
| `site/assets/css/style.css` | The whole design system |
| `site/assets/js/site.js` | Content, images, WhatsApp links, the mode switch |
| `site/assets/js/motion.js` | Movement and the photo viewer |
| `serve.py` | Local preview server |
| `site/robots.txt`, `sitemap.xml`, `404.html` | Search and error handling |

---

## 9. Shop payments, later

Phase 1 is "Order on WhatsApp", which is how people here actually buy. The structure is ready
for real payments: `config.js` has a `checkoutMode` value, products already carry `price`,
`options` and `soldOut`, and every order button comes from one function (`orderMessage` /
`waLink` in `site.js`). Adding a payment provider means changing that function, not
rebuilding the shop.

## 10. Domain

Canonical URLs, the sitemap and the social-preview tags use `https://sheontherun.com`. If the
site lands on a different domain, search for that string across `site/` and replace it.
