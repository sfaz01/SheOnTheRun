# SheOnTheRun admin — how to use it

One page for Fatima. Everything here is safe to try: nothing goes on the website until you press **Publish**, and every publish can be undone.

> **Screenshots** are marked `[picture: …]` — add them from the live admin before hand-over (the layout is the same on a phone).

---

## Signing in

1. Open **https://sheontherun.com/admin** (save it to your phone's home screen).
2. Your email, then your password.
3. Open your authenticator app and type the 6-digit code for SheOnTheRun.
4. If you ever lose the phone, choose **"I can't use my app — use a recovery code"** and use one of the codes you saved. Each works once.

`[picture: the sign-in screen]`

## Creating your owner account (the first time)

You create the website's first and only owner account yourself. Nobody else needs an account or knows your password.

1. Open **https://sheontherun.com/admin**. The first-time owner setup appears automatically.
2. Enter the private setup key sent to you through a password-manager share, then your email and a strong password.
3. Scan the QR code with your authenticator app and save the recovery codes somewhere private.

The setup key stops working as soon as your account is made.

## The five-minute tour

The menu on the left (bottom tabs on a phone) is the whole panel:

| Section | What it holds |
|---|---|
| **Overview** | New orders, unread messages, upcoming runs, low stock, last publish, a hosting check, and the activity log. |
| **Orders** | Every shop order: who, what, where, total. |
| **Messages** | Everything sent through the Connect form. |
| **Shop & products** | Products, prices, sizes, stock, delivery governorates. |
| **Runs & events** | The SheOnTheRun calendar and the weekly runs. |
| **Services & packages** | Consultations, packages and the BackOnTheRun challenge. |
| **Testimonials** | Client quotes (only with permission). |
| **Site settings** | WhatsApp number, emails, Instagram, switches for the shop and contact forms. |
| **Photos** | Every photo on the website, with descriptions. |
| **Photo galleries** | Which photos appear in the scrolling galleries, in what order. |
| **Journal** | Articles: write, save as a draft, publish. |
| **Meal plans** | The plan files you send clients, and the sample plan the tracker opens. |
| **Publish** | Puts your saved changes on the website; history and one-tap restore. |
| **Account** | Your email, password, and other admins. |

`[picture: the Overview screen, showing the "not published yet" badge]`

## Editing anything: save, preview, publish

- **Save** keeps your work as a **draft**. The website does not change yet.
- **Preview** opens the real website with your drafts on top — only you can see it. The yellow "not published" dot stays until you publish.
- **Publish** puts every saved change live at once, in English and Arabic. It takes a second; visitors may need to refresh.
- Changed your mind? **Publish → Discard all unpublished changes** throws the drafts away; the website stays as it was.
- **Publish → History** keeps every publish. **Restore** copies an old version back into your drafts (publish again to make it live).
- Working on two devices? If a change was saved elsewhere, the panel says so and asks you to reload — nothing is lost.

`[picture: the save bar with Preview and Go to Publish]`

## Orders

1. **Orders** in the menu; the badge shows new ones.
2. Open an order to see the items, phone, address and total. The website calculates the total from your prices, never the customer.
3. Move it along: **New → Confirmed → Out for delivery → Delivered** (or **Cancelled** — stock goes back automatically).
4. **Paid?** For a Whish/OMT transfer, tick **Paid** and paste the reference.
5. **WhatsApp** opens a chat with that customer, the order already written out.
6. **Export CSV** downloads everything for your records.
7. Notes are private — only admins see them.

`[picture: one order, open, with the status buttons]`

## Messages

Open a message, reply from your own email, then mark it **Handled**. The badge in the menu shows what's new.

## Shop, runs and everything else

- Big lists (**categories, products, events, services…**) work the same way: tap an item to open it, **+ Add** to create one, ↑↓ to reorder, **Duplicate** or **Delete** inside an item.
- Every English field has its Arabic twin beside it. A yellow **"Arabic missing"** flag means the Arabic side is empty — fill it before publishing.
- **Stock:** put how many are left per size. At 0 the size (or product) shows as sold out by itself. Empty means "not tracked".
- **Events** disappear from the site once their end time passes — no need to delete them.

## Photos

1. **Photos → Add a photo**: pick the file, write a short description in English and Arabic (it's read aloud to people who can't see it), name it, upload.
2. The server makes the sizes the website needs; a phone photo is fine.
3. **Choose photo** pickers (in products, events, articles) now list it.
4. A photo that is part of the website's pages can be **described and replaced**, not deleted.

## Journal articles

1. **Journal → + Add article**: topic, title, date, reading time, summary, cover photo, then write in the box. Headings, lists, quotes and links are in the toolbar.
2. Tick **Keep as a draft** while you're working — a draft isn't on the website at all.
3. Save, **Preview** to read it, then Publish. Publishing also updates the article list, the RSS feed and Google's sitemap.

## Meal plans

1. **Meal plans → Add a plan file**: upload the file you made for a client — a plan page (`.html`), a spreadsheet plan (`.csv`) or a saved copy (`.json`).
2. **Make it the sample** decides what the public **"Try the sample plan"** button opens. That choice goes live with Publish. The spreadsheet template the site hands out can't be deleted.
3. Files in this library can be opened by anyone who has the web address, so keep private client plans elsewhere, or give them a name only you know.

`[picture: the Meal plans screen with the sample flag]`

## Backups

- Every night a copy of the content, orders and messages is written to a private folder on the server (the newest 14 are kept).
- **Overview → Download backup** gives you the same file on your computer. Keep one somewhere safe now and then.

## If something looks wrong

- Reload the page first.
- If a change looks wrong on the site, **Publish → History → Restore** the previous version.
- Contact your developer if the hosting check on **Overview** shows a red **Fix** item, or if sign-in or publishing stops working.

---

**Try these once, unaided — then you know the panel:**

- [ ] Add a product with a photo, give it a price and stock, then publish.
- [ ] Mark something sold out.
- [ ] Add an event with 8 places, then cancel it.
- [ ] Change a package price.
- [ ] Write and publish a Journal article.
- [ ] Confirm an order through to Delivered.
- [ ] Upload a meal plan and make it the sample.
- [ ] Roll a publish back to the previous version.
