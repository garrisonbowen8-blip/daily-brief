# Iron Lace Bookstore — Website

A single-file, self-contained website for Iron Lace Bookstore. No build tools,
no frameworks — just open `index.html`.

## Preview it
Double-click `index.html` to open it in any browser. That's it.

## Add your photos
Drop image files into the `images/` folder using these exact names and they'll
appear automatically (the placeholders disappear once the file exists):

| File name              | Where it shows        | Suggested photo                         |
|------------------------|-----------------------|-----------------------------------------|
| `images/storefront.jpg`| Our Story (top frame) | The reclaimed-wood doorway / shelves    |
| `images/aisle.jpg`     | Our Story (tall frame)| The long aisle of bookshelves           |

You can add more later — just copy a `<figure class="frame">` block.

## Things to fill in (search `index.html` for `TODO`)
- **Owner's name** and the real founding year (currently "Est. 2021")
- **Real events** in the Events section (dates are examples)
- **Real staff picks** in the Staff Picks section
- **Address, phone, email, hours** in the Visit section
- **Social links** (Facebook / Instagram) in the footer
- **The map**: in the `<iframe>` src, change `q=bookstore` to your address,
  e.g. `q=123+Main+St,+Town,+ST`

## Publish it for free
**Option A — Netlify Drop (easiest):** go to https://app.netlify.com/drop and
drag this whole folder in. Done — you get a live link.

**Option B — GitHub Pages:** push this folder to a GitHub repo, then in
Settings → Pages, set the source to the branch and `/` folder.

## Design notes
- Fonts: Fraunces + Spectral (loaded from Google Fonts).
- Palette is drawn from the store itself — burnt/reclaimed wood, honey floors,
  the soft blue back wall, parchment, with aged-gold "iron lace" filigree and
  a muted Marine-scarlet accent.
- Rotating Scripture and gentle scroll animations are built in; everything
  respects "reduce motion" accessibility settings.
