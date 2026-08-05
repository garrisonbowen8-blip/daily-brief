# Iron Lace Bookstore — Website

A self-contained website for Iron Lace Bookstore (Anderson, SC) with a
built-in, no-code editor so the owners can update it themselves.

- `index.html` — the website
- `content/site.json` — the editable content (events, staff picks, hours, announcement)
- `admin/` — the friendly editor (Decap CMS) the owners log into
- `images/` — logo and photos

## Preview it
Double-click `index.html` to open it in any browser. (The events/books show
from the built-in copy; the live editable version loads once it's hosted.)

## Add the logo + photos
Drop image files into `images/` using these exact names — they appear
automatically:

| File name              | Where it shows           | Suggested image                         |
|------------------------|--------------------------|-----------------------------------------|
| `images/logo.png`      | Header + hero medallion  | The Iron Lace logo (square PNG is best) |
| `images/storefront.jpg`| Our Story (top frame)    | The reclaimed-wood doorway / shelves    |
| `images/aisle.jpg`     | Our Story (tall frame)   | The long aisle of bookshelves           |

## Still to confirm (search `index.html` for `TODO`)
- The **Our Story** wording / owners (currently Laurie Bowen Jacobs & Tiffany
  Addis Murr, opened Dec 1, 2021 — confirm this is how the family wants it told).

Already filled in: **address** (1213 Watkins Rd, Anderson, SC 29625),
**phone** ((864) 932-1295), **hours**, **map**, **Facebook/Instagram**, and the
½-price used-book model.

---

## How the owner updates the site (no code)
Events, staff picks, hours, and the announcement banner are stored in
`content/site.json` and edited through a simple login at **/admin**.
The owner fills out forms and clicks **Publish** — the live site updates in
about a minute. No files, no GitHub.

This is wired up but needs a one-time activation on Netlify (below).

## Publish it (one-time setup)

1. **Host on Netlify (connected to GitHub):**
   - netlify.com → Add new site → Import an existing project → GitHub →
     pick this repo.
   - **Base directory** and **Publish directory:** `iron-lace-bookstore`
   - **Branch:** whatever branch this lives on (and keep `admin/config.yml`'s
     `branch:` value matching it).
   - Build command: leave blank. Deploy.

2. **Use the real domain (ironlacebookstore.com):**
   - Netlify → Domain settings → Add a domain → `ironlacebookstore.com`
   - Update the domain's DNS at its registrar to point to Netlify (Netlify
     shows the exact records). HTTPS is automatic.

3. **Turn on the editor (so the owner can log in):**
   - Netlify → **Identity** → Enable Identity.
   - Identity → Registration → set to **Invite only**.
   - Identity → Services → **Enable Git Gateway**.
   - Identity → **Invite users** → enter the owner's email. She clicks the
     emailed link, sets a password, and lands in the editor at
     `ironlacebookstore.com/admin`.

## Design notes
- Fonts: Fraunces + Spectral (Google Fonts).
- Palette drawn from the store itself — burnt/reclaimed wood, honey floors,
  the soft blue back wall, parchment, aged-gold "iron lace" filigree, and a
  muted Marine-scarlet accent.
- Rotating Scripture, gentle scroll animations, fully responsive, and
  respects "reduce motion" accessibility settings.

---

## Owner dashboard (website visits + prayer requests)

A private dashboard lives at **`ironlacebookstore.com/admin/dashboard.html`**.
It shows visitor numbers, top pages, where visitors come from, and a private
feed of prayer requests. It uses the same login as the `/admin` editor, so
only invited owners can see it.

Behind the scenes it is two small serverless functions in
`netlify/functions/` (`prayer-requests` and `site-stats`). They only ever
respond to a logged-in owner — no login, no data.

> These functions require the site's **Base directory** in Netlify to be
> `iron-lace-bookstore` (as in the publish steps above). That's how Netlify
> finds `netlify.toml` and the `netlify/functions/` folder.

### A) Prayer requests (uses Netlify Forms — free)
The prayer feed reads your form submissions through the Netlify API, so it
needs **one** environment variable. In Netlify:
**Project configuration → Environment variables → Add a variable:**

| Key                 | Value |
|---------------------|-------|
| `NETLIFY_API_TOKEN` | A personal access token: avatar → **User settings → Applications → Personal access tokens → New access token**. Copy it once and paste it here. |

The site's ID is detected automatically (Netlify reserves the name `SITE_ID`,
so there's nothing to set). If you ever want to pin it explicitly, you can set
`IRONLACE_SITE_ID` to the Project ID from **Project configuration → General**.

Then **Deploys → Trigger deploy**. (Prayer-request *emails* are set up
separately: Forms → prayer-request → Notifications → Email.)

### B) Website visits (uses Cloudflare Web Analytics — free)
1. Create a free **Cloudflare** account → **Web Analytics → Add a site** →
   enter `ironlacebookstore.com`. It gives you a **beacon snippet** with a
   token.
2. In `index.html`, find the `CLOUDFLARE WEB ANALYTICS` comment near the
   bottom, paste your token in place of `PASTE_TOKEN`, and remove the two
   comment lines around the `<script>` tag. Commit/publish. Visits start
   recording. *(You can also just send the token to Claude to drop in.)*
3. To show the numbers **on the dashboard**, add two environment variables in
   Netlify (so the page can read your Cloudflare stats):

| Key            | Value |
|----------------|-------|
| `CF_API_TOKEN` | Cloudflare → My Profile → **API Tokens** → create a token with **Account Analytics: Read**. |
| `CF_SITE_TAG`  | The **site tag** = the `token` value inside the beacon snippet in `index.html`. |

The account is auto-detected from the token. (Optionally pin it with
`CF_ACCOUNT_TAG` = your Cloudflare Account ID.)

Until these are set, the dashboard still works — the visits area just shows a
"connect Cloudflare" note while the prayer feed works normally.
