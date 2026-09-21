# Fatima Mouzahem — personal website

Licensed dietitian · certified sports nutritionist · public health professional · founder of
SheOnTheRun. Beirut, Lebanon.

Plain HTML, one stylesheet, two scripts, and a handful of data files you edit yourself.
No build step, no framework, no npm. Pushing to `main` publishes it to GitHub Pages (see §11);
it also runs as-is on Netlify, Vercel, Cloudflare Pages or ordinary shared hosting.

---

## 1. Before you launch — two things to fill in

Open **`data/config.js`** and replace the two placeholders:

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

They live in `public/images/` and are named `slot-width.format`, e.g.

```
hero-road-wide-480.webp    hero-road-wide-480.jpg
hero-road-wide-960.webp    hero-road-wide-960.jpg
hero-road-wide-1440.webp   hero-road-wide-1440.jpg
hero-road-wide-2000.webp   hero-road-wide-2000.jpg
```

**`data/images.js` is the index of all of them.** Every photo is listed once with its
alt text — the description a screen reader reads aloud and Google indexes. If a description
is wrong, fix it there and it's fixed everywhere that photo appears.

**To swap a photo:** replace the files for that slot, keeping the same names and sizes.
**To change where photos appear:** `data/gallery.js` holds the photo runs — the moving
strip on the home page, the pinned run on SheOnTheRun, the album, the public-health
fieldwork grid, the China set. Reorder the names, add one, remove one; the page follows.

A few spots still show a designed placeholder rather than a photo — the wellness tools and
My Picks products in the shop. They're waiting on product shots. Drop images in and list
them in `data/products.js` and the placeholders disappear.

---

## 3. What you edit, and where

Everything that changes lives in **`data/`**. Plain text files with instructions at the
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

**Testimonials are samples.** The three quotes in `data/testimonials.js` are layout
samples — nobody said those words. They are marked `sample: true`, which means they show
(with an amber *"Sample"* label) only on your own computer, and **never on the live site**.
Until real quotes are added, the "What clients say" section simply doesn't appear online.
Add real client words (with their permission) and leave out `sample: true`.

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
| `index.html` | Home — the road portrait, credentials, the four areas |
| `about.html` | About me — The Human / The Professional Me / 2014→2026 |
| `dietontherun.html` | The practice — approach, services, packages, challenge, journal |
| `sheontherun.html` | The community — story, pinned photo run, calendar, album |
| `public-health.html` | Consulting — expertise, fieldwork, the path, publications |
| `shop.html` | Shop — categories, products, WhatsApp ordering |
| `connect.html` | Connect — interest selector, form, direct routes |
| `journal/` | The Journal — index and articles |
| `data/` | **Everything you edit** |
| `public/images/` | **Your photographs**, at four widths each |
| `assets/css/style.css` | The whole design system |
| `assets/js/site.js` | Content, images, WhatsApp links, the mode switch |
| `assets/js/motion.js` | Movement and the photo viewer |
| `serve.py` | Local preview server |
| `robots.txt`, `sitemap.xml`, `404.html` | Search and error handling |

---

## 9. Shop payments, later

Phase 1 is "Order on WhatsApp", which is how people here actually buy. The structure is ready
for real payments: `config.js` has a `checkoutMode` value, products already carry `price`,
`options` and `soldOut`, and every order button comes from one function (`orderMessage` /
`waLink` in `site.js`). Adding a payment provider means changing that function, not
rebuilding the shop.

## 10. Domain

Canonical URLs, the sitemap and the social-preview tags use `https://sheontherun.com`. If the
site lands on a different domain, search for that string across the project and replace it (and in `tools/build.js`).


---

## 11. Publishing

Pushing to `main` runs `.github/workflows/deploy.yml`, which:

1. copies only the website into a clean folder (no README, `serve.py`, `tools/` or editor files);
2. runs `tools/build.js`, which writes the Journal's **RSS feed** (`feed.xml`) and a fresh
   **sitemap** from `data/posts.js` — so a new article only needs adding in one place;
3. publishes to GitHub Pages.

**Custom domain.** Every canonical link points at `https://sheontherun.com`. When that
domain is ready, add a file called `CNAME` at the project root containing just
`sheontherun.com`, and point the domain's DNS at GitHub Pages. Until then the site lives at
`https://sfaz01.github.io/SheOnTheRun/`, and all internal links work there too.

---

## 12. Switches in `config.js`

Everything below is off until you paste a value in, and the site works without any of them.

| Setting | What it turns on |
| --- | --- |
| `formEndpoint` | The Connect form sends messages straight to your inbox (free at formspree.io) and shows a thank-you, instead of opening the visitor's email app. |
| `bookingUrl` | Every "Book" button and the discovery call open your real calendar (Cal.com or Calendly) instead of WhatsApp. |
| `newsletterEndpoint` | A "Letters from the run" sign-up appears in the footer of every page (Buttondown, MailerLite or Substack). |
| `plausibleDomain` / `cloudflareToken` | Visitor statistics. Both are cookie-free, so no consent banner is needed. Never runs on your own machine. |

---

## 13. What's new on the pages

- **The lap** (home) — your story as one 400m in four hundreds, with a runner that goes round
  as the page scrolls. The About timeline now shows the year you're on large over the photo,
  with a rail that fills as you read.
- **Find your best fit** (DietOnTheRun) — three or four questions that end on one
  recommendation, its price and a booking button. The questions and the reasons it gives live
  in `data/packages.js` under `fit`.
- **Before you book** — an FAQ, from `data/faq.js`, also given to Google as FAQ data. The
  answers only use what the site already said; add the ones people really ask you (payment,
  cancellations, what to bring).
- **Trained & worked with** — a single line of institutions on the home page.
- **Calendar** — every run has "Add to calendar" (Google, Apple, Outlook). Add `spots: 8` to
  an event in `data/runs.js` to show "8 places left" (`0` shows "Fully booked").
- **The shop bag** — people add several things and send one WhatsApp order listing them all,
  sizes included. Remembered on their own phone only.
- **Journal** — a reading-progress line, an automatic "In this article" list, share buttons
  (WhatsApp, copy link), category filters once there's more than one kind of article, and
  the RSS feed.
- **Arabic home page** — `ar/index.html`, right-to-left, with Arabic type (Noto Naskh Arabic
  and IBM Plex Sans Arabic) and Arabic WhatsApp messages. The switch is in the header. It
  links into the English pages for now. **Please have the Arabic read by you or a native
  speaker before launch** — it speaks for you and your licence.
- **Feel** — pages cross-fade into each other instead of flashing white, links start loading
  when you hover them, one button colour everywhere, the shop opens on a photograph like
  every other page, and an app icon for phones' home screens.
