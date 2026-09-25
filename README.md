# Wild and The Sun Açaí Cafe website

A six-page static customer website for Wild and The Sun in Aberfoyle Park. Home, Menu, Venue Hire, Our Story, Visit and Book are separate pages. The site includes the café's complete menu, real photography, family story and an interactive venue-hire planner. Ordering links directly to the café's Square page. Table reservations use the CentralPass **native** booking API when this venue's backend is configured. There is no local ordering or checkout flow.

## Public review preview

The current review build is available at https://wild-and-the-sun-preview.pages.dev/ on a dedicated Cloudflare Pages Direct Upload project. The preview sends `X-Robots-Tag: noindex` while the venue photos, final domain, and CentralPass deployment are pending. Table bookings currently use the phone fallback. Run `pwsh -File .\deploy-preview.ps1` to rebuild and publish updates to the same URL.

## Run locally

Run `node build.mjs`, then serve this folder with a static server, for example `python -m http.server 4173`. Open `http://localhost:4173`. Do not open the HTML files directly from the filesystem when testing API access. The build step verifies that the committed static pages and scripts are present. Shared styling is in `design.css`, shared interactions are in `site.js`, the full menu is in `menu-data.js`, venue-hire interactions are in `venue-planner.js`, and the CentralPass booking integration is in `booking.js`.

## Connect CentralPass

1. Provision a **separate Wild and The Sun** CentralPass backend/database. Do not use Primo Firle's deployment.
2. In that venue's settings, set `restaurant_name` to Wild and The Sun Açaí Cafe and configure booking hours, capacity, table layout, notification channels and `booking_settings.provider = 'native'` with `enabled = true`.
3. Set `centralpassApiBase` in `config.js` to the venue's HTTPS backend origin, without `/api`. The frontend calls `GET /api/bookings/config`, `GET /api/bookings/availability?date=YYYY-MM-DD&party_size=N`, and `POST /api/bookings`.
4. Add the final website HTTPS origin to the backend's comma-separated `CORS_ORIGIN`, then deploy both services. If using the private booking hub, set its `BOOKING_PORTAL_URL` to a correctly configured Wild and The Sun portal.
5. Test an actual reservation against this venue's database, staff diary, confirmation delivery and management link. The public form will fall back to phone booking if the API is unavailable, disabled, set to another provider, or identifies another venue.

No API secret belongs in the browser. The booking form uses the public CentralPass endpoints and a per-request UUID. It respects max party size, booking horizon, native provider selection, live slot availability, pending/confirmed status, and optional deposit policy. Payments, if enabled later, complete through the CentralPass booking portal; they are not activated by this website.

## Replace before launch

- Confirm which remaining illustrative `scene-*` and placeholder images should stay before launch. Primary menu, homepage, story and venue-hire sections now use supplied café photography and custom artwork.
- Confirm whether the café wants the approved photographic logo in the header or the current typographic treatment.
- Confirm opening hours and phone with the owner. Current values come from the [Aberfoyle Hub store directory](https://www.aberfoylehub.com.au/stores-map/), checked on 23 September 2026.
- Verify the Square ordering destination, `https://wild-and-the-sun.square.site/s/order#most-popular`, at launch.
