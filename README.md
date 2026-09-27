# Wild and The Sun café website

Four static pages: **Home**, **Menu**, **Visit us** (our story, groups and occasions, hours and location) and **Book a table**. The old `/story/` and `/venue-hire/` addresses redirect to the matching part of Visit us. Every Order online action opens the café's Square store; ordering is not part of CentralPass.

## What comes from CentralPass

The site connects to Wild and The Sun's own CentralPass backend for three things only:

| On the site | Comes from | Where the café changes it |
|---|---|---|
| Venue name, phone, address, email, ABN | `GET /api/settings/public` | Admin → Settings → Venue |
| Opening hours, today's open/closed status, special days | `GET /api/settings/hours` | Admin → Hours (the **Hours** feature) |
| Table bookings and Stripe booking deposits | `/api/bookings/*`, `/api/booking-portal/checkout` | Admin → Settings → Bookings, staff diary |

Details are read at build time, so the HTML, footer and search data already carry them, and read again in the browser by `venue.js`, so an edit in the admin shows on the site straight away without a rebuild. A blank email or ABN in the admin hides that line. The site refuses to show details from a backend whose venue name is not Wild and The Sun. `src/venue.json` is only the fallback used when no backend is configured or it cannot be reached.

### Booking flow

`booking.js` loads the booking settings, shows live availability for the actual party size, and creates the booking with a retry-safe `request_id`. When the venue's deposit rules apply, the guest accepts the displayed policy, the table is held as pending, and they go straight to Stripe Checkout. Payment is confirmed by Stripe webhooks on the backend, never by this page. Stripe returns the guest to their private CentralPass booking page. If they come back to the site without paying, the held table is recovered from the session and they can pay or open their booking page. When the backend is unset, bookings are switched off, or anything fails, the page offers a phone booking using the admin phone number.

## Connecting the backend

Build or deploy with the backend's HTTPS origin (no `/api`):

```powershell
pwsh -File .\deploy-live.ps1 -ApiBase https://api.wildandthesun.com.au
```

`CENTRALPASS_API_BASE` works the same way for `node build.mjs`. The build writes `config.js` and a Content-Security-Policy in `_headers` that only allows network requests to that origin, so rebuild whenever the API address changes.

On the CentralPass side, before switching it on:

1. **Console:** enable **Bookings**, **Booking deposits** and **Hours** for this venue. Nothing else is needed.
2. **Backend environment:** `CORS_ORIGIN` must include this site's origin (for example `https://wild-and-the-sun.pages.dev` and any custom domain). `BOOKING_PORTAL_URL=https://<api host>/booking` so guests have a booking page and Stripe has somewhere to return. `BOOKING_PAYMENTS_ENABLED=true` with the venue's own `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, and the Stripe webhook at `/api/stripe/webhook` sending `checkout.session.completed` and `charge.refunded`.
3. **Admin → Settings → Venue:** the name must contain "Wild … Sun". Fill in phone, address, and email and ABN if they should appear.
4. **Admin → Hours:** enter the real trading hours. A new venue starts with Monday to Saturday 7am to 3pm and Sunday closed, which the site and the booking diary would otherwise show.
5. **Admin → Settings → Bookings:** turn on online bookings and save the deposit rules the café has approved.
6. Test in Stripe test mode first: a normal booking, a deposit booking paid and abandoned, a cancellation refund, and confirm each appears in the staff diary.

The platform allows 20 public booking requests a minute per visitor. The page caches availability briefly so moving between days does not use that up.

## Local build

Run `node build.mjs`, then serve this folder with `python -m http.server 4173`. Pages are generated from `src/layout.html`, `src/nav.html`, `src/footer.html` and `src/pages/*.html`. Venue details in templates must use the `{{VENUE_*}}` markers; the build fails if a phone number or address is hard-coded. Styles are in `design.css`; interactions in `site.js`; venue details in `venue.js`; bookings in `booking.js`.

To test against a local CentralPass backend, run it on port 3000 with `CORS_ORIGIN=http://localhost:4173` and build with `CENTRALPASS_API_BASE=http://localhost:3000`. Rebuild without it before committing so `config.js` does not point at your machine.

Photos in `assets/client` and `assets/graphic/family-instagram.webp` have 560, 800 and full-width WebP versions. The build serves them automatically with the original as a fallback; generate the same three sizes for any new photo.

## Deployment

- Preview: `pwsh -File .\deploy-preview.ps1` publishes https://wild-and-the-sun-preview.pages.dev/. Without `-ApiBase`, the preview's Book page runs `booking-demo.js`: sample times and a sample deposit rule, clearly labelled, with nothing saved or charged, so the booking form can be reviewed before the backend exists.
- Live: `pwsh -File .\deploy-live.ps1` publishes https://wild-and-the-sun.pages.dev/. The live build never includes the demo.

Both stay `noindex` until launch. Security headers come from the generated `_headers` file.

## Before search launch

- Replace `assets/menu-preview.svg` with the café's approved menu image, keeping the full-size link and useful alt text.
- Set `PUBLIC_SITE_ORIGIN` to the final custom HTTPS domain if there is one, and `SITE_INDEXABLE=true`, then rebuild.
- Connect and test the venue's CentralPass backend as above, and review the venue details and hours in the admin with the owner.
- Keep the Square destination current: https://wild-and-the-sun.square.site/s/order#most-popular
