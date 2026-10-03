# Handoff: SheOnTheRun admin panel — read this fully before touching anything

You are continuing work on a project another AI assistant (Claude) has been building with the user. Read this whole document first, then read `docs/admin-panel-plan.md` and `docs/hostinger-setup.md`. Do not start coding until you have confirmed the current state (section 4).

## 1. The project in one paragraph

A personal website for **Fatima Mouzahem** (licensed dietitian, sports nutritionist, public-health professional, Beirut, Lebanon; founder of SheOnTheRun running community and DietOnTheRun practice). The site is **plain static HTML + one stylesheet + two scripts + data files** (`data/*.js`) — no framework, no build step. The owner wants to "add some products to the shop, update schedules… small things here and there" before launch **without touching code**, so we are building a **private admin panel** (PHP + MySQL on Hostinger) where she manages everything that changes. The site is bilingual (English + Arabic in `/ar/`), RTL-aware. Domain: **sheontherun.com**. Repo: `github.com/sfaz01/SheOnTheRun`. The user (a developer helping a friend/client) is **not deeply technical in hosting/SSH** and prefers small steps in plain language.

## 2. How the system works (architecture decisions already made — do not relitigate)

- **Hosting:** the user's existing Hostinger Cloud Startup account (shared with ~20 OTHER unrelated sites — never touch any folder except sheontherun.com's). Site web root: `/home/u586950607/domains/sheontherun.com/public_html`. Secrets file `sotr-config.php` lives one level above it (outside web root, mode 600). SSH: `82.25.126.244:65002`, user `u586950607`. MySQL database and user are both `u586950607_sotr` (Hostinger prefixes names with the account id).
- **Backend:** framework-free PHP 8.x in `server/app/` (classes under namespace `Sotr`, loaded by `server/app/bootstrap.php`), one front controller `api/index.php`, SQL migrations in `server/database/migrations/` (auto-applied on API requests by `Migrator::ensure()`). MySQL in production, **SQLite locally** (migration files use `{{PK}}`, `{{TEXT}}`, `{{ENGINE}}` tokens so one file serves both).
- **Admin UI:** vanilla JS, no build, no external requests, in `admin/` (`core.js` helpers, `editor.js` generic schema-driven editor, `admin.js` shell/auth/publish/account). Strict CSP (`admin/.htaccess`): no inline scripts/styles. All server strings go in via `textContent`/DOM builder — **never innerHTML**. Mobile-first (the owner edits from her phone).
- **Content model ("the key design choice"):** each editable area (`shop`, `runs`, `offer`, `testimonials`, `settings`, plus `extras`, `images`) is one JSON document in table `content`. **Saving = draft. Publish = validate everything, then regenerate the SAME `data/*.js` files the website already reads** (`window.SITE_SHOP`, `SITE_RUNS`, `SITE_OFFER`, `SITE_TESTIMONIALS`, `SITE`, `SITE_AR`) atomically (temp file + rename), and record a snapshot in `publishes` (history, restore, discard). The public site stays static and never depends on the database. **Arabic words live inside each item as `item.ar = {...}`** in the DB, and the generator splits them back out into `data/ar.js` matched by id (exactly how the site already expects it).
- **One schema drives everything:** `server/app/Schema.php` defines every editable field once; it is sent to the browser to build forms and used by `Validator.php` for server-side validation with field-path errors (e.g. `categories.0.items.2.price`). Add fields there, not in two places.
- **Auth (phase 0, done, tested):** Argon2id passwords (≥12 chars), **mandatory TOTP 2-step** + 8 one-time recovery codes, lock-out after repeated failures (`RateLimit`), CSRF token + same-origin + JSON-only on every write (`Http::guardWrite`), sessions with idle/absolute timeouts, audit log. Admin invites use a one-time code (no email needed).
- **Deploy:** GitHub Actions `Deploy to Hostinger` (manual `workflow_dispatch`, rsync over SSH, **never `--delete`**, validates/trims secrets, tests the SSH connection first). **Panel-owned files are excluded from deploy** (`data/{config,products,runs,packages,testimonials,ar}.js`) so a deploy never overwrites what the owner published. Tests run in CI (`backend-tests.yml`).
- **Private preview:** the whole public site is behind an HTTP basic-auth prompt (clearly marked `PRIVATE PREVIEW` block at the top of root `.htaccess`) until the owner says go. LiteSpeed ignores the `Require all granted` exemption in `admin/` and `api/`, so the admin currently sits behind the preview prompt too. Launching = delete that block, commit, deploy.

## 3. History — what has been done

1. **Plan** written (`docs/admin-panel-plan.md`): 13 manageable areas, phases 0–5.
2. **Phase 0 (DONE, live):** backend foundation, sign-in + 2-step, hosting check dashboard, deploy pipeline, private preview. Live on sheontherun.com/admin. First admin account exists (the developer's email).
3. **Security incidents handled:** a deploy private key was pasted into chat → revoked on the server and replaced (`sotr-actions` key). Lesson: never ask for or echo secrets.
4. **Phase 1 (DONE, committed on branch `admin-phase-1`, commit `939b8bd`, NOT yet confirmed merged/deployed):** editors for shop/products (with **stock per size** — public `shop.html` now disables sold-out sizes and caps the cart at stock, EN+AR), runs & events (Beirut time; past events hide themselves), services & packages (+ BackOnTheRun challenge), testimonials, site settings; Publish/History/Restore/Discard; stale-tab conflict detection; Account page (change email, invite/remove admins). 28 automated tests pass (`server/tests/*.test.mjs`, `unit.php`), including a **round-trip test proving the generated data files equal today's hand-written ones**. Content seed: `server/database/seed/content.json`, regenerated by `node tools/export-content.mjs`.
5. **A previous AI session** then wrote unreviewed phase 2/3 backend code. A review found it unfit to ship. It is **parked, untouched, on branch `parked-phase-2-3`** (do NOT merge it). Section 6 lists exactly what was wrong so you do not repeat it.

**Phase 2 (built, tested, branch `admin-phase-2`):** photo library (server-side GD resize to the site's widths in WebP+JPEG, EXIF rotation, alt text EN+AR, replace/delete rules; seeded photos can't be deleted), photo galleries editor, Journal editor (rich text sanitised server-side by `Sanitizer.php`; Publish writes `journal/<slug>.html` from `server/templates/article.html`, `feed.xml`, `sitemap.xml`, `data/posts.js`, `images.js`, `gallery.js`; unpublishing removes the page). Existing live databases upgrade themselves on first admin request (`Content::ensureSeeded`). Deploys no longer overwrite journal pages, feed, sitemap or any existing photo. Known gaps: no scheduled publishing (draft/published only), EXIF rotation is implemented but untested (no EXIF fixture), photo upload needs GD/exif/dom on the host (the Hosting check reports them).

**Phase 3 (built, tested, branch `admin-phase-3`):** public `POST /api/orders` and `/api/messages` (same-origin JSON only, honeypot, per-IP and global throttles, nothing trusted from the browser: prices/stock/governorates from the PUBLISHED shop snapshot, unknown sizes rejected, qty limits). `Stock.php` changes stock in the live snapshot with compare-and-swap inside the order transaction, mirrors it into the draft, and rewrites `data/products.js`; cancelling/deleting returns stock; history restore keeps current stock. `Mailer.php` (SMTP, header-injection-safe; recipients only from Site settings). Admin Orders (statuses, payment/paid, notes, search, CSV export that neutralises formulas) and Messages screens with nav badges. Public `site.js` posts to the admin only when Site settings `adminOrders` / `adminMessages` are on (fallbacks to WhatsApp/email remain). Tests: `orders.test.mjs`, `ratelimit.test.mjs` (fake SMTP server in `smtp.mjs`). Not yet done: mailbox config on Hostinger, privacy wording, card payments (phase 5).

## 4. First steps for you (verify, don't assume)

1. `git fetch`; confirm whether `admin-phase-1` has been merged into `main` and whether "Deploy to Hostinger" has been run since. If not, remind the user of the steps: open the PR, merge, Actions → Deploy to Hostinger → Run workflow with **"include content" OFF**.
2. Run the full suite before changing anything: `php server/tests/unit.php` and `node --test server/tests/*.test.mjs` (needs PHP 8.1+ on PATH; on Windows `winget install PHP.PHP.8.3` — `server/tests/php.mjs` and `server/dev/serve.mjs` auto-enable extensions). Local dev server: `node server/dev/serve.mjs` → http://localhost:8092/admin/ (local setup token `dev-setup-token`; publishes locally go to `server/storage/dev-site`, never over the repo's `data/` files).
3. Read `memory`-style facts here and `docs/`. Ask the user only for decisions that are genuinely theirs.

## 5. The roadmap (what's left)

**Phase 2 — Photos + Journal — DONE on branch `admin-phase-2` (see section 3 note), needs merge + deploy.** Original scope:
- Photo library: upload → automatic resize into the site's existing scheme (**widths 480/960/1440/2000, WebP + JPEG**, files `public/images/<slot>-<width>.<ext>`), **alt text in English and Arabic**, gallery assignment/reorder (`data/gallery.js` has `community` and `fieldwork` runs), and make uploaded photos selectable in the product/event image pickers. Must handle phone photos: **apply EXIF orientation**, validate real image type, size limits, store under a safe generated name.
- Journal: write/edit articles in the panel with draft/scheduled/published; Publish generates the real HTML pages in `journal/`, plus `feed.xml` and `sitemap.xml` (today `tools/build.js` builds those in CI from `data/posts.js`; the panel must take over ownership without breaking the CI path — and the deploy must then stop overwriting `journal/`, `feed.xml`, `sitemap.xml`, `data/posts.js`, `data/images.js`, `data/gallery.js`). **Sanitise article HTML with a strict allow-list** (the plan requires it). The two existing articles' bodies live in `journal/*.html`; import them properly so Publish never replaces a full article with its excerpt.
- Everything must go through the **same draft → Publish → history/rollback + conflict-check pipeline** as the other areas.

**Phase 3 — Orders + Messages — DONE on branch `admin-phase-3` (stacked on `admin-phase-2`); needs merge + deploy + the mail setup in docs/hostinger-setup.md.** Original scope:
- Public checkout posts to the API; **server recalculates prices from the PUBLISHED shop data (not drafts)**, validates option names (reject, never silently substitute), checks and decrements stock **atomically**, stores the order, emails the owner. Payments: cash on delivery + Whish/OMT transfer (manual "paid" flag); order statuses New → Confirmed → Out for delivery → Delivered/Cancelled; notes; CSV export (paginate; neutralise spreadsheet formula injection: prefix cells starting with `= + - @`); one-tap WhatsApp to customer. Messages inbox for the Connect form. Admin screens for both (mobile-first), badges in nav.
- Anti-abuse is mandatory: honeypot **plus working rate limiting** (record every submission, not only failures — see section 6), max items/qty per order, optionally Cloudflare Turnstile.
- Email: Hostinger SMTP via config (`mail.*` in `sotr-config.php`), **recipient addresses come from Site settings (`emails`), not hard-coded**; **never accept a recipient from the request**.
- Stock decrement must update the **published** data the shop reads AND keep draft/published consistent (design this deliberately; a decrement that only edits the draft leaves the live shop stale and is undone by Discard/Restore).

**Phase 4 — Polish + hand-over:** dashboard widgets, audit-log view, nightly DB export (cron), meal-plan library, a one-page how-to with screenshots, a 30-minute walkthrough for the owner.

**Phase 5 — Card payments** only when the owner has a merchant account (Lebanon: Stripe is unavailable; Areeba/Whish Pay are candidates). Not before.

**Also pending / known debts**
- Restrict the deploy SSH key to her folder (user chose "keep unrestricted for now"; this account hosts ~20 other sites). Options: forced-command gate in `authorized_keys` (the user must apply it — see "Constraints") or a folder-limited FTP account.
- Add an `Arabic missing` summary and Arabic admin UI (optional, later).
- Launch checklist: owner reviews Arabic text (written by AI), real testimonials (3 current ones are marked `sample`), WhatsApp number (`[[WHATSAPP NUMBER]]` placeholder), Formspree endpoints or the new API, remove the private-preview block.
- Open owner decisions: payment gateway/bank; whether Fatima writes Journal articles herself (user said "Fatima writes").

## 6. Lessons: what the last unreviewed attempt got wrong (these are the bar)

A review of `parked-phase-2-3` found blockers. Do not reproduce them:
1. It made Publish also rewrite `data/images.js` from a data shape that didn't match what was stored → **every photo name would vanish from the site**. Always verify generated files against the live ones (extend `roundtrip.test.mjs`).
2. Publish regenerated journal pages from stored `bodyHtml` that was empty for existing articles → **full articles replaced by their one-line excerpt**.
3. Public contact endpoint accepted an `inbox` address from the visitor → **open mail relay**. Never take recipients from input.
4. "Rate limiting" called `RateLimit::check` but nothing ever recorded events → **no limit at all**; a script could sell out the shop. Record every public submission.
5. Orders read the **draft** shop (unpublished prices/products orderable), deducted stock only in the draft, silently swapped invalid sizes, and the tests never asserted a price or stock value.
6. Media/gallery/journal bypassed the draft/conflict/history pipeline; photo upload changed the `images` shape and would crash the product image picker; no EXIF handling; CSV export capped at 200 rows with formula injection; article HTML unsanitised; hard-coded owner emails.
7. Its tests only checked happy paths and status codes. **Tests must assert outcomes** (exact prices, stock numbers, generated file contents, that unauthorised/abusive requests are refused).

## 7. Engineering standards (non-negotiable)

- **Verify before claiming done:** run the tests, run the real thing in a browser (preview at localhost:8092), check desktop and a 375px phone viewport, and check the console for CSP errors. Say plainly what you did NOT verify.
- **Security:** all SQL parameterised; every admin route requires sign-in; every write goes through `Http::guardWrite`; validate on the server (the browser is never trusted — especially prices and stock); no secrets in the repo or chat; no `innerHTML` with data; keep the CSP.
- **Write tests that can fail:** end-to-end tests against a real PHP server on SQLite (`server/tests/helpers.mjs` has `startServer`, `client`, `totp`, `enrol`). Keep unit tests in `server/tests/unit.php`.
- **Match the codebase:** same naming, comment density and voice (plain English comments explaining why); admin copy is plain language for a non-technical owner ("Publish", "Save draft", "Sold out"), not developer jargon. Keep the site's look unchanged unless asked.
- **Don't over-build:** no frameworks, no build step, no new dependencies unless unavoidable (the only vendored library is `admin/vendor/qrcode.js`).
- **Git:** work on a branch (never commit straight to `main`); small meaningful commits; end commit messages with the attribution line your tooling requires; never force-push; **never merge or deploy without the user's go-ahead.**

## 8. Constraints about the user and the environment

- The user's terminal is **Windows PowerShell 5.1**. Never give bash-only syntax (`cmd < file` failed once). Use `Get-Content … -Raw | Set-Clipboard` etc. Git Bash is available to the agent.
- Guide the user in **small parts, one at a time, waiting for "done"**, with exact menu names and what they should see. Long checklists made them lose the thread.
- **Never ask the user to paste a private key, password, token or the setup key into chat.** (A private key was pasted once and had to be rotated.)
- The agent's sandbox blocked: reading/copying the private key to the clipboard, and editing `~/.ssh/authorized_keys` on the server. Don't try to work around those; hand the step to the user.
- Server changes by SSH (key `~/.ssh/sotr-actions`, host fingerprint pinned in a known_hosts file): do only what the task needs, read-only first, keep backups, never touch other `domains/*` sites.
- Safety: don't deploy to production, change DNS, or alter server access rules without explicit user approval for that specific action.

## 9. Things the user may ask next

"Finish phase 1 deploy" → section 4 step 1. "Start phase 2" → read section 5/6, plan the photo + journal design on the existing pipeline first, show the user the plan, then build with tests. "Why does X fail on the server" → read the hosting check on the admin Overview and `/api/health` first. Keep answers short, honest and in plain language.
