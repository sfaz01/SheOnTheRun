# Fatima Mouzahem — personal website

Static website built from *Personal Website: Structure & Content Brief*. No build step, no
dependencies, no framework — plain HTML, one stylesheet, one script. Upload the `site/`
folder to any host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, or normal shared
hosting) and it runs.

## Run it locally

```bash
python -m http.server 8091 --directory site
```

Then open <http://localhost:8091>.

## What's here

| File | Page |
| --- | --- |
| `site/index.html` | Home — her, credentials, four areas of work |
| `site/about.html` | About me — The Human / The Professional Me / 2014→2026 journey |
| `site/nutrition.html` | DietOnTheRun — approach, services, packages, FAQ |
| `site/sheontherun.html` | SheOnTheRun — story, upcoming runs, community |
| `site/public-health.html` | Public Health — consulting, expertise, publications |
| `site/shop.html` | Shop — club merch, wellness tools, My Picks, coming soon |
| `site/connect.html` | Let's Connect — routed contact form |
| `site/journal/` | The Journal — index plus one complete article |
| `site/assets/css/style.css` | The whole design system |
| `site/assets/js/main.js` | Menu, mode switch, filters, form |

## Design decisions worth knowing

**Colour.** The palette comes from the SheOnTheRun logo, but both brand hues are deepened
(lilac `#6A52C4`, teal `#15707F`) so they pass WCAG AA contrast. The original pastels are
kept only for large background washes. Each area of work owns one accent — teal for
nutrition, lilac for community, olive for public health, ink for the shop — so a returning
visitor learns the site by colour.

**Type.** Archivo (display) echoes the blocky logo; Newsreader (serif) carries long-form
reading; IBM Plex Mono is used *only* for prices, dates, labels and navigation. The mono
signals measurement and precision, which suits a dietitian and researcher, and keeps the
site from drifting into generic-wellness looks.

**Single light theme, deliberately.** Painted explicitly so it holds regardless of the
visitor's OS dark-mode setting.

**Content is static HTML, not JavaScript-rendered.** Every price, event and product is real
markup: it works with JS disabled, and search engines read all of it. JavaScript only adds
the mobile menu, the in-person/online switch, event filters and form conditionals.

**The in-person / online switch** is one decision that drives the whole nutrition page —
the intro copy, which body-composition lines appear, and the pre-filled WhatsApp message on
every booking button. The choice is stored in the URL (`nutrition.html?mode=online`), so a
link can be shared with the format already selected.

## Before launch — required

These are the only things standing between this and a live site. Everything marked with an
amber `TODO` badge on the pages themselves corresponds to an item here.

1. **WhatsApp number.** Currently the placeholder `9611234567`, in 35 places.
   Replace across the whole site with one command:
   ```bash
   cd site && grep -rl 9611234567 . | xargs sed -i 's/9611234567/<REAL NUMBER>/g'
   ```
   Use digits only, with country code, no `+` or spaces. It also appears once per page as
   `data-whatsapp` on the `<html>` tag, which is what the mode switch reads.

2. **Email address.** The brief cuts off mid-sentence ("my email is") so no address was
   supplied. Placeholder `hello@example.com` appears in `connect.html` (2 places).

3. **Pricing model.** The brief prices packages in fixed weekly blocks (4/6/10 weeks) in
   Section 6, but its own Hello Healthy reference asks for monthly recurring pricing by
   access tier. **This build ships the fixed-week model as written and priced in the
   brief.** If the monthly model is preferred, the four cards in `nutrition.html` need new
   copy and prices.

4. **Event dates.** The runs shown reproduce the brief's schedule (Thu 17, Tue 22, Wed 23
   September, 6:30 PM at Biel). Confirm the live calendar before launch, and note that
   these are hand-edited in `sheontherun.html` and `index.html` — see *Next steps* about
   moving them to a CMS.

5. **Photography.** Every image is a labelled placeholder naming the shot the layout wants.
   Replace each `<div class="ph …">` with a real `<img>`:
   ```html
   <img src="assets/img/hero-portrait.jpg" alt="Fatima Mouzahem" width="1000" height="1250">
   ```
   The brief's Drive folder covers running, competition, UN and China. The gaps needing a
   shoot are: hero portrait, consultation/working shots, food, and product photography.
   Per the Lea Mia Asfour reference: no stock imagery anywhere.

6. **Testimonials.** Three placeholder quotes on the home page and three on the nutrition
   page. Replace with real quotes and get written consent from each person.

7. **Contact form backend.** The form validates and shows its success state but sends
   nothing. Point it at a form service (Formspree, Netlify Forms, Basin) or an endpoint.

8. **Logo permissions.** UNICEF, WFP, AUB and the Ministry of Public Health are shown as
   text on the public health page pending clearance to use their marks.

9. **CV PDF** for the public health page download button.

## Before launch — recommended

- **Redirects from the old site.** The current site uses hash routing (`/#/about`,
  `/#/events`, `/#/join`). Hash fragments never reach the server, so server-side 301s can't
  see them — add a small client-side redirect that reads `location.hash` on load and
  forwards to the new pages. Every Instagram link in circulation points at those URLs.
- **Analytics.** `main.js` fires a `booking_intent` console event on every booking click.
  Replace `console.info` with the real analytics call — WhatsApp bookings leave the site, so
  that click is the only conversion signal available.
- **Seed the journal** with at least six articles so the index doesn't look abandoned. One
  is written in full as the template.

## Next steps beyond launch

The obvious first upgrade is moving events, products and articles into a CMS so they can be
edited from a phone rather than by hand-editing HTML. Astro plus Sanity would preserve this
design exactly while making the content editable; the templates here map one-to-one onto
components. Until then, adding a run means copying an `<article class="event">` block in
`sheontherun.html` and changing four values.

## Accessibility and quality notes

Verified during the build: no horizontal overflow at 400px, one `<h1>` per page, no
duplicate IDs, all internal links resolve, visible focus rings, skip links, keyboard-
operable menu/tabs/filters/accordions, `prefers-reduced-motion` respected, anchor targets
clear the sticky header, and schema.org markup for Person, HealthAndBeautyBusiness, FAQPage
and Article.
