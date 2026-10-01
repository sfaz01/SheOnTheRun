# Phase 0 — Hostinger setup checklist

Everything the code can do is done and tested locally. These are the steps only **you** can do, because they need your Hostinger and GitHub logins. Do them in order. Each step says what to send back if something looks different from this guide.

> Hostinger changes its menus now and then. If a label differs slightly, look for the closest match and tell me what you see.

## A. Prepare the hosting (hPanel → Websites → sheontherun.com)

1. **PHP version.** Advanced → PHP Configuration. Choose **PHP 8.2 or 8.3** (8.1 is the minimum).
   On the *Extensions* tab make sure these are ticked: `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `gd`, `curl`, `zip`.
   On the *Options* tab set `upload_max_filesize = 16M` and `post_max_size = 20M`.
2. **HTTPS.** Security → SSL. Install the free SSL for `sheontherun.com` (and `www`). When it shows *Active*, switch on **Force HTTPS**.
   The site's `.htaccess` also redirects to `https://sheontherun.com`, but the certificate has to exist first.
3. **Database.** Databases → Management → create a MySQL database and user. Write down the **database name, user name, password and host** (usually `localhost`).
4. **SSH access.** Advanced → SSH Access → enable it. Write down the **IP/host, port (usually 65002) and username**.
5. **Create a deploy key** on your PC (PowerShell). This makes a key GitHub will use to upload files; there is no passphrase because a robot uses it:

   ```bash
   ssh-keygen -t ed25519 -f sotr-deploy -C "github-deploy" -N ""
   ```

   Back in hPanel (SSH Access → *Add SSH key*), paste the contents of **`sotr-deploy.pub`**. Keep `sotr-deploy` (no `.pub`) private. It goes only into GitHub in step C.
6. **Check that the server has `rsync`** (the deploy uses it):

   ```bash
   ssh -p PORT -i sotr-deploy USER@HOST "which rsync && php -v | head -1"
   ```

   If `rsync` is missing, tell me. I'll switch the deploy to SFTP.
7. **Get the server's fingerprint** (so GitHub knows it's talking to the real server):

   ```bash
   ssh-keyscan -p PORT -t ed25519 HOST
   ```

   Copy the whole output line.

## B. Put the secrets file on the server

In hPanel → Files → File Manager, go **one level above `public_html`** (the folder that contains `public_html`, typically `domains/sheontherun.com/`). Create a file named **`sotr-config.php`** based on `server/config.sample.php`:

- `setup_token`: a long random string. Make one with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
- `db`: the four values from step A3.

This file holds passwords. It never goes into GitHub, and being above `public_html` it can't be downloaded from the web.

## C. Give GitHub the keys (repo → Settings → Secrets and variables → Actions → *New repository secret*)

| Secret name | Value |
|---|---|
| `HOSTINGER_SSH_HOST` | host/IP from A4 |
| `HOSTINGER_SSH_PORT` | port from A4 (e.g. `65002`) |
| `HOSTINGER_SSH_USER` | username from A4 |
| `HOSTINGER_SSH_KEY` | the full contents of the private file `sotr-deploy` |
| `HOSTINGER_SSH_KNOWN_HOSTS` | the line from A7 |
| `HOSTINGER_SITE_DIR` | full path to the web folder, e.g. `/home/u123456789/domains/sheontherun.com/public_html` |

## D. First deploy

1. Commit and push this work to `main`.
2. GitHub → Actions → **Deploy to Hostinger** → *Run workflow*, with "include content" **on**.
   It runs the tests first, then uploads. It never deletes anything on the server.
3. Open `https://sheontherun.com`. The site should load.

## E. First sign-in

1. Go to `https://sheontherun.com/admin/`.
2. Enter the **setup token** from step B, your email, and a strong password.
3. Scan the QR code with an authenticator app, type the 6-digit code, and **save the recovery codes**.
4. The dashboard's **Hosting check** lists anything that isn't right. Send me a screenshot of it.
5. Once you're in, edit `sotr-config.php` and delete the `setup_token` line.

## If something goes wrong

- *"The database isn't ready yet"*: the details in `sotr-config.php` are wrong. Re-check step A3.
- *Locked out (lost phone and recovery codes)*: over SSH, `php server/bin/create-admin.php EMAIL NEWPASSWORD` resets the password and the authenticator setup.
- The old GitHub Pages site (`sfaz01.github.io/SheOnTheRun`) keeps working until you decide to retire it.
