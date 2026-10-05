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

## Part 2 — Create Fatima's account (do NOT know her password)

- [ ] Sign in as yourself → **Account → Invite an admin** → enter Fatima's email (and yours if you want her, or the owner, to share access).
- [ ] Copy the **one-time invite code** it shows. It works once.
- [ ] Decide the preview password to share with her (or ask your developer to set a fresh one).

She will use the invite to choose her own password and set up her phone code — you never see or store her password.

## Part 3 — Prepare the pack

- [ ] Fill the screenshot boxes in `owners-guide.html`, then **Print → Save as PDF** (see `README.md`).
- [ ] Record a **2–4 minute walkthrough** (Loom, or Windows **Win+G**): sign in → Overview → open Shop, change a price, **Save** → **Preview** → **Publish** → an order → a Journal draft. Use a test order so no real customer data shows.
- [ ] Open `COVER-MESSAGE.md`, paste in the guide PDF and the video link.

## Part 4 — The 30-minute hand-over call

- [ ] Send the cover message (guide + video) the day before.
- [ ] On the call, share the preview password, the URL and the invite code **securely** (password-manager private share, or read them aloud — never plain email/WhatsApp).
- [ ] Watch her, unaided: sign in → choose a password → scan the QR with her authenticator app → **save the recovery codes** somewhere safe.
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

- Never email, WhatsApp or paste a password, invite code, recovery code or SSH key into chat.
- Prefer the **invite** (she sets her own password) over you creating one for her.
- The preview password is low-risk (it only hides a not-yet-public site) but still share it like a secret.