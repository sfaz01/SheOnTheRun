# Hand-over checklist — you (the developer)

What to do, in order, to put the finished admin in front of Fatima and let her run the site. Tick as you go. Stop and fix anything red before moving on.

## Part 0 — Before you start

- [ ] Tests are green locally: `php server/tests/unit.php` and `node --test server/tests/*.test.mjs` (expect 78 pass).
- [ ] The phase-4 branch is pushed: `admin-phase-4` is on GitHub at `114e25b` (or later).
- [ ] You know the **private-preview password** for the site (the `PRIVATE PREVIEW` block in the root `.htaccess`, password in `domains/sheontherun.com/.htpasswd`).

## Part 1 — Make it live

- [ ] Merge the pull request for `admin-phase-4` into `main` (GitHub → the PR → **Merge**).
  - Merging to `main` also fires **Deploy to GitHub Pages** — that is the browser-redirect site, harmless here.
- [ ] GitHub → **Actions → Deploy to Hostinger → Run workflow**, branch `main`, **include content = OFF** (leaving it on overwrites what Publish writes). Wait for both jobs to pass.
- [ ] Open `https://sheontherun.com/admin/` in a browser. You should get the sign-in screen with the two locks (preview password, then your admin login + code).
- [ ] Sign in and check **Overview**: the stat cards, upcoming runs, low stock, the activity log and the hosting check all load. Every check should be OK (no red **Fix**).

> The deploy never deletes anything and never overwrites what the admin published, so re-running it is safe.

## Part 2 — Fatima creates the only owner account

- [ ] Do **not** create an admin account for yourself or anyone else.
- [ ] Put a long, random `setup_token` in the private server configuration (see `docs/hostinger-setup.md`). It exists only for the first owner setup and closes automatically after use.
- [ ] Give that private setup key to Fatima through a password-manager private share. It is not an invite and it never gives you access to her account.
- [ ] Decide the preview password to share with her (or ask your developer to set a fresh one).

Fatima creates her own password and phone code. Once she finishes, she is the sole administrator and the first-time setup screen closes permanently.

## Part 3 — Prepare the pack

- [ ] Fill the screenshot boxes in `owners-guide.html`, then **Print → Save as PDF** (see `README.md`).
- [ ] Record a **2–4 minute walkthrough** (Loom, or Windows **Win+G**): sign in → Overview → open Shop, change a price, **Save** → **Preview** → **Publish** → an order → a Journal draft. Use a test order so no real customer data shows.
- [ ] Open `COVER-MESSAGE.md`, paste in the guide PDF and the video link.

## Part 4 — The 30-minute hand-over call

- [ ] Send the cover message (guide + video) the day before.
- [ ] Before the call, securely share the preview password, the admin URL and the one-time private setup key (password-manager private share — never plain email/WhatsApp).
- [ ] Watch her, unaided: create her owner account → choose a password → scan the QR with her authenticator app → **save the recovery codes** somewhere safe.
- [ ] Walk the "Your first five minutes" checklist in the guide with her.
- [ ] Leave her with: the PDF, the admin URL, and your contact for anything red.

## Part 5 — After

- [ ] She's driving. You stay on standby for the hosting check and anything that fails to publish.
- [ ] Launch-day items still open (tell the owner, don't silently fix):
  - [ ] The **WhatsApp number** is still a placeholder (`[[WHATSAPP NUMBER]]`) in Site settings.
  - [ ] The **Arabic text** was written by an assistant — have Fatima or a native reader check it.
  - [ ] The three **testimonials** are marked *sample*.
  - [ ] **Card payments** are not built — the shop is cash-on-delivery plus a manual Whish/OMT mark-as-paid.
  - [ ] When she's ready to go public, delete the `PRIVATE PREVIEW` block in `.htaccess`, commit, and re-run **Deploy to Hostinger**.

## Handling secrets — the rules

- Never email, WhatsApp or paste a password, setup key, recovery code or SSH key into chat.
- Never create an account for Fatima. The first-time setup gives her the sole owner account directly.
- The preview password is low-risk (it only hides a not-yet-public site) but still share it like a secret.
