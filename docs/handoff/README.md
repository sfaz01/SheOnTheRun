# Hand-over pack — SheOnTheRun admin

Everything you need to hand the admin panel to Fatima. Three pieces:

| File | For | What it is |
|---|---|---|
| `owners-guide.html` | Fatima | The owner's guide. Open it in a browser and **Print → Save as PDF** to send her a clean, professional PDF. |
| `HANDOVER-CHECKLIST.md` | You | The step-by-step to make it live, add her account, and give her access. |
| `COVER-MESSAGE.md` | You → Fatima | An email and a short WhatsApp message to introduce the hand-over. |

These live in `docs/`, which is **excluded from the deploy** and blocked by the site's `.htaccess`, so nothing here ever appears on the live website.

## 1. Print the guide to PDF

1. Open `owners-guide.html` in Chrome or Edge.
2. Click **Print / save as PDF** (top-right).
3. Destination **Save as PDF**, paper **A4**, margins **Default**, **Background graphics ON**.
4. Save it as `SheOnTheRun-admin-guide.pdf`.

## 2. Add the screenshots (optional, but nicer with them)

Each dashed box in the guide is a placeholder. To use a real screenshot, replace the box element with:

```html
<img class="shot-img" src="images/signin.png" alt="The sign-in screen">
```

and add one line to the `<style>` block:

```css
.shot-img { width: 100%; border: 1px solid var(--line); border-radius: 8px; margin: .8rem 0; }
```

Take the shots from the live admin (`https://sheontherun.com/admin`) or a local run (`node server/dev/serve.mjs`, then `http://localhost:8092/admin/`). A 375px-wide phone shot is fine — the panel looks the same there.

## 3. Before you send anything

Read `HANDOVER-CHECKLIST.md` to the end first. **Never email a password or the private first-time setup key** — use a password-manager private share or hand it over in person.
