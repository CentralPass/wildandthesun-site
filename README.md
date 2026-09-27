# Wild and The Sun café website

Six separate static pages: Home, Menu, Gather Here, Our Story, Visit, and Book a Table. The site uses the café's photographs and official logo, plus a clearly marked temporary menu image. It has no ordering flow or duplicated product catalogue. Every Order Online action opens the café's Square store.

## Review preview

The phone-friendly review build is published to https://wild-and-the-sun-preview.pages.dev/. This Cloudflare Pages preview sends `X-Robots-Tag: noindex`. Run `pwsh -File .\deploy-preview.ps1` to rebuild and update it.

## Local build

Run `node build.mjs`, then serve this directory with `python -m http.server 4173`. The build generates each page from `src/layout.html`, `src/nav.html`, `src/footer.html`, and `src/pages/*.html`. Shared styles and interactions are in `design.css` and `site.js`.

## Café admin connection

The site currently shows verified fallback contact details and hours. `config.js` intentionally leaves `centralpassApiBase` empty until Wild and The Sun has its own backend. When it is ready, set this to that venue's HTTPS API origin, without `/api`, and allow the final site origin in the backend's CORS configuration. Do not point it at another venue's backend or expose private keys in browser code.

`business-settings.js` reads only `GET /api/settings/public` and `GET /api/settings/hours` to update the café name, address, phone and trading hours. It checks the venue name first. Ordering controls, ordering availability, payment methods and private admin settings are not used. Changes to the business details and hours are made in the venue's existing admin.

The Book page uses `GET /api/bookings/config`, `GET /api/bookings/availability` and `POST /api/bookings` when native bookings are enabled for this venue. Until then, or if the service is unavailable, the page offers a phone booking link. Before enabling live bookings, verify the venue identity, CORS, table inventory, a real reservation, diary visibility, confirmation delivery and booking management link.

## Before public launch

- Replace `assets/menu-preview.svg` with the café's approved menu image, keeping the full-size image link and useful alt text.
- Confirm the final domain and build with `PUBLIC_SITE_ORIGIN` set to that HTTPS origin to emit canonical URLs and a sitemap.
- Configure and test the venue's own admin and booking backend.
- Review fallback phone, address and hours against the owner. Current fallback hours and phone are listed by the Aberfoyle Hub store directory.
- Keep the Square destination current: https://wild-and-the-sun.square.site/s/order#most-popular.
