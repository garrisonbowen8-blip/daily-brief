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
