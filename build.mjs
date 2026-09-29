import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const publicOrigin = (process.env.PUBLIC_SITE_ORIGIN || 'https://wild-and-the-sun.pages.dev').replace(/\/+$/, '');
// Search engines and AI crawlers stay out until the owner approves launch.
// Set SITE_INDEXABLE=true for the live site then. Previews never set it.
const indexable = process.env.SITE_INDEXABLE === 'true';
const squareUrl = 'https://wild-and-the-sun.square.site/s/order#most-popular';
const instagramUrl = 'https://www.instagram.com/wild_and_the_sun_acai_cafe/';
const facebookUrl = 'https://www.facebook.com/p/Wild-and-the-Sun-Acai-Cafe-61572911067431/';
const uberEatsUrl = 'https://www.ubereats.com/au/store/wild-and-the-sun-acai-cafe-aberfoyle-park/57cwlGKJVz2NsWWez7BPSQ';
const agfgUrl = 'https://www.agfg.com.au/restaurant/wild-and-the-sun-acai-cafe-134964';
const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=Wild%20and%20the%20Sun%20Acai%20Cafe%20Aberfoyle%20Park';
// Aberfoyle Hub Shopping Centre (OpenStreetMap). The café is inside the centre.
const geo = { latitude: -35.0751, longitude: 138.5929 };
const nearbySuburbs = ['Happy Valley', 'Flagstaff Hill', 'Coromandel Valley', 'Chandlers Hill'];
const venueNamePattern = /wild.*sun/i;

// The Wild and The Sun CentralPass backend origin, e.g. https://api.wildandthesun.com.au
// The site reads venue details, hours and bookings from it. Leave it empty to
// build with src/venue.json and the phone-booking fallback. Never point this at
// another venue's backend.
const centralpassApiBase = (process.env.CENTRALPASS_API_BASE || '').trim().replace(/\/+$/, '');
if (centralpassApiBase) {
  const url = new URL(centralpassApiBase);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('CENTRALPASS_API_BASE must use HTTPS.');
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('CENTRALPASS_API_BASE must be an origin only, without /api.');
}

// Preview builds can show the booking form with sample data (booking-demo.js)
// before the venue's backend exists. Never used when a real backend is set.
const bookingDemo = process.env.BOOKING_DEMO === 'true' && !centralpassApiBase;
const onlineBooking = Boolean(centralpassApiBase);

const pages = [
  {
    slug: '', key: 'home', crumb: 'Home', type: 'WebPage',
    title: 'Açaí Bowls & Coffee in Aberfoyle Park | Wild and The Sun',
    description: 'Family-run açaí café at Aberfoyle Hub, Aberfoyle Park SA. Acai bowls, specialty coffee, Dubai chocolate croissants and waffles. Book a table or order ahead.',
    ogImage: '/assets/og/home.jpg', ogAlt: 'Wild and The Sun açaí cups topped with berries and soft serve',
    preload: { name: 'client/acai-trio', sizes: '(max-width: 900px) 64vw, 30vw' },
  },
  {
    slug: 'menu', key: 'menu', crumb: 'Menu', type: 'WebPage',
    title: 'Menu: Açaí Bowls, Coffee & Pastries | Wild and The Sun',
    description: 'Our café menu in Aberfoyle Park: classic and kids açaí bowls, pistachio and matcha lattes, Dubai chocolate croissants, waffles, quesadillas and smoothies.',
    ogImage: '/assets/og/menu.jpg', ogAlt: 'Berry drink topped with chocolate soft serve at Wild and The Sun',
    preload: { name: 'client/berry-choc', sizes: '(max-width: 900px) 70vw, 32vw' },
  },
  {
    slug: 'visit', key: 'visit', crumb: 'Visit us', type: 'AboutPage',
    title: 'Hours & Location at Aberfoyle Hub | Wild and The Sun',
    description: 'Find Wild and The Sun inside Aberfoyle Hub Shopping Centre near Woolworths, Aberfoyle Park SA: opening hours, directions, our story and group catch-ups.',
    ogImage: '/assets/og/visit.jpg', ogAlt: 'The family behind Wild and The Sun outside their café at Aberfoyle Hub',
    preload: { name: 'graphic/family-instagram', sizes: '(max-width: 900px) 70vw, 32vw' },
  },
  {
    slug: 'book', key: 'book', crumb: 'Book a table', type: 'WebPage',
    title: 'Book a Table in Aberfoyle Park | Wild and The Sun',
    description: 'Book a table at Wild and The Sun, the family-run açaí café at Aberfoyle Hub, Aberfoyle Park. ' + (onlineBooking ? 'Choose a day and time online or call the café.' : 'Call the café and we’ll save you a seat.'),
    ogImage: '/assets/og/book.jpg', ogAlt: 'Two specialty drinks ready to share at Wild and The Sun',
    scripts: (bookingDemo ? '<script src="/booking-demo.js?v={{VERSION}}" defer></script>' : '') + '<script src="/booking.js?v={{VERSION}}" defer></script>',
  },
  {
    slug: 'privacy', key: 'privacy', crumb: 'Privacy', type: 'WebPage',
    title: 'Privacy | Wild and The Sun',
    description: 'How Wild and The Sun handles your personal information when you visit the website, book a table, pay a deposit or order online.',
    ogImage: '/assets/og/home.jpg', ogAlt: 'Wild and The Sun açaí cups topped with berries and soft serve',
  },
];

// Older pages were folded into Visit us. Keep their URLs working.
const redirects = [
  { slug: 'story', to: '/visit/#story' },
  { slug: 'venue-hire', to: '/visit/#gather' },
];

const configJs = '// Generated by build.mjs from CENTRALPASS_API_BASE. Change that variable and rebuild; do not edit this file.\nwindow.WILD_SUN_CONFIG = Object.freeze({ centralpassApiBase: ' + JSON.stringify(centralpassApiBase) + ' });\n';
// Cache-busting version from the shipped CSS/JS, so an unchanged rebuild
// produces identical pages and does not dirty the committed build output.
const shippedCode = await Promise.all(['design.css', 'site.js', 'venue.js', 'booking.js', ...(bookingDemo ? ['booking-demo.js'] : [])].map((file) => readFile(file, 'utf8')));
const version = createHash('sha256').update(configJs).update(shippedCode.join('\n')).digest('hex').slice(0, 10);
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

const jsonLd = (data) => '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>';

function clockTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(String(value || ''));
  return match ? match[1] + ':' + match[2] : null;
}

function displayTime(value) {
  const [h, m] = value.split(':').map(Number);
  return String(h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h >= 12 ? 'pm' : 'am');
}

function normaliseHours(rows) {
  if (!Array.isArray(rows)) return null;
  const byDay = new Map();
  for (const row of rows) {
    const day = Number(row.day_of_week);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    const open = clockTime(row.open_time);
    const close = clockTime(row.close_time);
    byDay.set(day, row.is_open && open && close ? { day_of_week: day, is_open: true, open_time: open, close_time: close } : { day_of_week: day, is_open: false, open_time: null, close_time: null });
  }
  return byDay.size === 7 ? [0, 1, 2, 3, 4, 5, 6].map((day) => byDay.get(day)) : null;
}

async function getJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(centralpassApiBase + path, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(path + ' returned ' + response.status);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Venue details come from the CentralPass admin portal (Settings > Venue) and
// hours from its Hours page. src/venue.json is only the offline fallback.
async function loadVenue() {
  const fallback = JSON.parse(await readFile('src/venue.json', 'utf8'));
  const venue = { name: fallback.name, phone: fallback.phone, address: fallback.address, email: fallback.email || null, abn: fallback.abn || null, hours: normaliseHours(fallback.hours) };
  if (!venue.hours) throw new Error('src/venue.json needs seven valid hours rows.');
  if (!centralpassApiBase) return { venue, source: 'src/venue.json' };
  let settings;
  try {
    settings = await getJson('/api/settings/public');
  } catch (error) {
    console.warn('Warning: could not read venue details from CentralPass (' + error.message + '). Using src/venue.json; the live site refreshes them in the browser.');
    return { venue, source: 'src/venue.json (CentralPass unreachable)' };
  }
  if (!venueNamePattern.test(String(settings.restaurant_name || ''))) {
    throw new Error('CENTRALPASS_API_BASE belongs to "' + settings.restaurant_name + '", not Wild and The Sun. Refusing to build with another venue’s details.');
  }
  const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  venue.name = text(settings.restaurant_name) || venue.name;
  for (const key of ['phone', 'address']) {
    if (text(settings[key])) venue[key] = text(settings[key]);
    else console.warn('Warning: the admin portal has no venue ' + key + '; using src/venue.json.');
  }
  // Optional fields follow the admin exactly: blank there means hidden here.
  venue.email = text(settings.email);
  venue.abn = text(settings.abn);
  if (settings.features?.hours !== false) {
    try {
      const hours = normaliseHours((await getJson('/api/settings/hours')).store_hours);
      if (hours) venue.hours = hours;
      else console.warn('Warning: CentralPass hours were incomplete; using src/venue.json hours.');
    } catch (error) {
      console.warn('Warning: could not read CentralPass hours (' + error.message + '); using src/venue.json hours.');
    }
  }
  return { venue, source: 'CentralPass admin portal' };
}

const { venue, source: venueSource } = await loadVenue();
const menu = JSON.parse(await readFile('src/menu-highlights.json', 'utf8'));

const flatAddress = venue.address.replace(/\s*\n\s*/g, ', ');
const telHref = 'tel:' + venue.phone.replace(/[^0-9+]/g, '');
// Schema.org prefers an international number: 0451 661 351 -> +61 451 661 351.
const phoneInternational = /^0\d/.test(venue.phone.trim()) ? '+61 ' + venue.phone.trim().slice(1) : venue.phone.trim();
const directionsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(venue.name + ', ' + flatAddress);
const addressLines = venue.address.split(/\s*[\n,]\s*/).filter(Boolean);

// Monday first for reading. venue.js highlights today and refreshes the rows.
const hoursList = [1, 2, 3, 4, 5, 6, 0].map((index) => {
  const row = venue.hours[index];
  const time = row.is_open ? displayTime(row.open_time) + ' – ' + displayTime(row.close_time) : 'Closed';
  return '<li data-day="' + index + '"><span>' + dayNames[index] + '</span><strong>' + time + '</strong></li>';
}).join('');

// Neighbouring days with the same hours, Monday first.
function hourGroups(hours) {
  const groups = [];
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    const row = hours[day];
    const text = row.is_open ? displayTime(row.open_time) + '–' + displayTime(row.close_time) : null;
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.to = day;
    else groups.push({ from: day, to: day, text });
  }
  return groups;
}

// "Tue – Sat 9am – 5pm · Sun 9am – 2pm · Mon closed"
function hoursSummary(hours) {
  const short = (day) => dayNames[day].slice(0, 3);
  return hourGroups(hours).map((group) => (group.from === group.to ? short(group.from) : short(group.from) + ' – ' + short(group.to)) + ' ' + (group.text ? group.text.replace('–', ' – ') : 'closed')).join(' · ');
}

// "Tuesday to Saturday 9am–5pm and Sunday 9am–2pm, closed Monday"
function hoursSentence(hours) {
  const name = (group) => (group.from === group.to ? dayNames[group.from] : dayNames[group.from] + ' to ' + dayNames[group.to]);
  const groups = hourGroups(hours);
  const open = groups.filter((group) => group.text).map((group) => name(group) + ' ' + group.text);
  const closed = groups.filter((group) => !group.text).map(name);
  const list = (items) => (items.length > 1 ? items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1] : items[0] || '');
  return list(open) + (closed.length ? ', closed ' + list(closed) : '');
}

const venueJson = JSON.stringify({ name: venue.name, phone: venue.phone, address: venue.address, email: venue.email, abn: venue.abn, hours: venue.hours }).replace(/</g, '\\u003c');

// Short, factual answers that search engines and AI assistants can quote.
const faqs = [
  { q: 'Where is Wild and The Sun?', a: 'Wild and The Sun is at ' + flatAddress + ', inside Aberfoyle Hub Shopping Centre near Woolworths. It’s in Aberfoyle Park in Adelaide’s southern suburbs, close to ' + nearbySuburbs.slice(0, -1).join(', ') + ' and ' + nearbySuburbs[nearbySuburbs.length - 1] + '.' },
  { q: 'What is an açaí bowl?', a: 'Açaí (say ah-sah-EE) is a deep-purple berry from the Amazon with a rich berry and chocolate flavour. We serve it soft and creamy, topped with fresh fruit, granola, nut butters and drizzles. Our Classic Açaí Bowl comes with banana, strawberry, granola and honey, and there’s a Kids Açaí Bowl too.' },
  { q: 'Is Wild and The Sun only an açaí bar?', a: 'No, it’s a full café. As well as açaí bowls and smoothies, there’s espresso coffee and specialty lattes such as pistachio, cookie butter and spiced matcha, Dubai chocolate and pistachio croissants, loaded banana bread, waffles, quesadillas and milkshakes.' },
  { q: 'What are the opening hours?', a: 'We’re open ' + hoursSentence(venue.hours) + '. Hours can change on public holidays, so call ' + venue.phone + ' if you’re making a special trip.' },
  { q: 'Can I book a table?', a: onlineBooking ? 'Yes. Book online at ' + publicOrigin + '/book/ by choosing a day, time and group size, or call ' + venue.phone + '. For birthdays and bigger groups, call us to plan it together.' : 'Yes. Call ' + venue.phone + ' during opening hours and we’ll save you a table. For birthdays and bigger groups, call us to plan it together.' },
  { q: 'Do you do takeaway or delivery?', a: 'Yes. Order ahead for pickup through our online store, or order delivery through Uber Eats.' },
  { q: 'Are there options for kids and special diets?', a: 'There’s a Kids Açaí Bowl and babyccinos for little ones, a veggie quesadilla, and a gluten-free brownie. Please tell the team about any allergies when you order.' },
];

const faqHtml = faqs.map((item, index) => '<details class="faq-item"' + (index === 0 ? ' open' : '') + '><summary><h3>' + escapeHtml(item.q) + '</h3><span class="faq-icon" aria-hidden="true"></span></summary><div class="faq-answer"><p>' + escapeHtml(item.a) + '</p></div></details>').join('\n');

const toneFor = { acai: 'tone-acai', coffee: 'tone-mint', sweet: 'tone-blush', savoury: 'tone-sun', cold: 'tone-mint' };
const menuHtml = menu.sections.map((section) => '<section class="menu-section ' + (toneFor[section.id] || 'tone-blush') + '" aria-labelledby="menu-' + section.id + '" data-reveal><h3 id="menu-' + section.id + '">' + escapeHtml(section.name) + '</h3><p>' + escapeHtml(section.description) + '</p><ul role="list">' + section.items.map((item) => '<li><strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(item.description) + '</span></li>').join('') + '</ul></section>').join('\n');

// ---------- Structured data: one linked graph per page ----------

function postalAddress() {
  const match = /^(.*?),\s*([^,]+?)\s+(SA|NSW|VIC|QLD|WA|TAS|NT|ACT)\s+(\d{4})$/i.exec(flatAddress);
  return match
    ? { '@type': 'PostalAddress', streetAddress: match[1], addressLocality: match[2], addressRegion: match[3].toUpperCase(), postalCode: match[4], addressCountry: 'AU' }
    : { '@type': 'PostalAddress', streetAddress: flatAddress, addressCountry: 'AU' };
}

const cafeId = publicOrigin + '/#cafe';
const websiteId = publicOrigin + '/#website';

function cafeNode() {
  return {
    '@type': 'CafeOrCoffeeShop',
    '@id': cafeId,
    name: venue.name,
    alternateName: ['Wild and The Sun', 'Wild & The Sun', 'Wild and the Sun Acai Cafe'],
    slogan: 'A little wild. A lot of sunshine.',
    description: 'Family-run açaí café inside Aberfoyle Hub Shopping Centre in Aberfoyle Park, South Australia, serving açaí bowls, smoothies, specialty coffee, pastries and café food.',
    url: publicOrigin + '/',
    logo: publicOrigin + '/assets/brand/official-logo-full.jpg',
    image: pages.map((page) => publicOrigin + page.ogImage),
    telephone: phoneInternational,
    ...(venue.email ? { email: venue.email } : {}),
    ...(venue.abn ? { taxID: venue.abn } : {}),
    address: postalAddress(),
    geo: { '@type': 'GeoCoordinates', latitude: geo.latitude, longitude: geo.longitude },
    hasMap: mapsUrl,
    areaServed: ['Aberfoyle Park', ...nearbySuburbs].map((name) => ({ '@type': 'Place', name: name + ', South Australia' })),
    containedInPlace: { '@type': 'ShoppingCenter', name: 'Aberfoyle Hub Shopping Centre', address: { '@type': 'PostalAddress', streetAddress: 'Corner Hub Drive and Sandpiper Crescent', addressLocality: 'Aberfoyle Park', addressRegion: 'SA', postalCode: '5159', addressCountry: 'AU' } },
    servesCuisine: ['Açaí bowls', 'Café', 'Coffee', 'Smoothies', 'Desserts'],
    knowsAbout: ['Açaí bowls', 'Specialty coffee', 'Pistachio lattes', 'Dubai chocolate croissants', 'Smoothies'],
    priceRange: '$',
    currenciesAccepted: 'AUD',
    acceptsReservations: true,
    menu: publicOrigin + '/menu/',
    hasMenu: publicOrigin + '/menu/',
    openingHoursSpecification: venue.hours.filter((row) => row.is_open).map((row) => ({
      '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/' + dayNames[row.day_of_week], opens: row.open_time, closes: row.close_time,
    })),
    sameAs: [instagramUrl, facebookUrl, uberEatsUrl, agfgUrl],
    potentialAction: [
      { '@type': 'ReserveAction', target: { '@type': 'EntryPoint', urlTemplate: publicOrigin + '/book/', inLanguage: 'en-AU' }, result: { '@type': 'FoodEstablishmentReservation', name: 'Table booking at ' + venue.name } },
      { '@type': 'OrderAction', target: { '@type': 'EntryPoint', urlTemplate: squareUrl, inLanguage: 'en-AU' }, deliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModePickUp' },
    ],
  };
}

function structuredData(page, canonicalUrl) {
  const graph = [
    cafeNode(),
    { '@type': 'WebSite', '@id': websiteId, url: publicOrigin + '/', name: venue.name, inLanguage: 'en-AU', publisher: { '@id': cafeId } },
    {
      '@type': page.type, '@id': canonicalUrl + '#webpage', url: canonicalUrl, name: page.title, description: page.description, inLanguage: 'en-AU',
      isPartOf: { '@id': websiteId }, about: { '@id': cafeId },
      primaryImageOfPage: { '@type': 'ImageObject', url: publicOrigin + page.ogImage, width: 1200, height: 630 },
      ...(page.key === 'home' ? {} : { breadcrumb: { '@id': canonicalUrl + '#breadcrumb' } }),
    },
  ];
  if (page.key !== 'home') {
    graph.push({ '@type': 'BreadcrumbList', '@id': canonicalUrl + '#breadcrumb', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: publicOrigin + '/' },
      { '@type': 'ListItem', position: 2, name: page.crumb, item: canonicalUrl },
    ] });
  }
  if (page.key === 'home') {
    graph.push({ '@type': 'FAQPage', '@id': canonicalUrl + '#faq', isPartOf: { '@id': canonicalUrl + '#webpage' }, mainEntity: faqs.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })) });
  }
  if (page.key === 'menu') {
    graph.push({
      '@type': 'Menu', '@id': canonicalUrl + '#menu', name: venue.name + ' café menu', url: canonicalUrl, inLanguage: 'en-AU',
      description: 'Menu highlights. Current items and prices are on the café’s online ordering store.',
      hasMenuSection: menu.sections.map((section) => ({
        '@type': 'MenuSection', name: section.name, description: section.description,
        hasMenuItem: section.items.map((item) => ({ '@type': 'MenuItem', name: item.name, description: item.description })),
      })),
    });
  }
  return jsonLd({ '@context': 'https://schema.org', '@graph': graph });
}

// Photos ship as responsive WebP (560, 800 and full width) with the original
// file as the fallback. Templates can set data-sizes for small placements.
const fullWidth = (name) => (name.endsWith('family-instagram') ? 1100 : 1122);
const webpSet = (name) => [560, 800, fullWidth(name)].map((width) => '/assets/' + name + '-' + width + '.webp ' + width + 'w').join(', ');

function responsiveImages(html) {
  return html.replace(/<img\b[^>]*\ssrc="\/assets\/(client|graphic)\/([\w-]+)\.(jpg|webp)"[^>]*>/g, (tag, folder, file) => {
    const name = folder + '/' + file;
    if (![560, 800, fullWidth(name)].every((width) => existsSync('./assets/' + name + '-' + width + '.webp'))) return tag;
    const sizes = /data-sizes="([^"]+)"/.exec(tag)?.[1] || '(max-width: 900px) 92vw, 46vw';
    let img = tag.replace(/\s*data-sizes="[^"]+"/, '');
    // Off-screen photos decode without blocking the main thread.
    if (/loading="lazy"/.test(img) && !/decoding=/.test(img)) img = img.replace(/<img\b/, '<img decoding="async"');
    return '<picture><source type="image/webp" srcset="' + webpSet(name) + '" sizes="' + sizes + '" />' + img + '</picture>';
  });
}

const [layout, nav, footer] = await Promise.all([
  readFile('src/layout.html', 'utf8'),
  readFile('src/nav.html', 'utf8'),
  readFile('src/footer.html', 'utf8'),
]);

const hardCodedVenue = /0451 661 351|\+61451661351|130-150 Hub Drive/;
for (const [name, source] of [['layout', layout], ['nav', nav], ['footer', footer]]) {
  if (hardCodedVenue.test(source)) throw new Error('Hard-coded venue details in src/' + name + '.html. Use the {{VENUE_*}} markers.');
}

const siteMarkers = {
  VENUE_NAME: escapeHtml(venue.name),
  VENUE_PHONE: escapeHtml(venue.phone),
  VENUE_TEL: escapeHtml(telHref),
  VENUE_ADDRESS: escapeHtml(flatAddress),
  VENUE_ADDRESS_LINES: addressLines.map(escapeHtml).join('<br />'),
  VENUE_DIRECTIONS: escapeHtml(directionsUrl),
  VENUE_ABN: escapeHtml(venue.abn || ''),
  VENUE_ABN_HIDDEN: venue.abn ? '' : 'hidden',
  VENUE_EMAIL: escapeHtml(venue.email || ''),
  VENUE_MAILTO: escapeHtml(venue.email ? 'mailto:' + venue.email : ''),
  VENUE_EMAIL_HIDDEN: venue.email ? '' : 'hidden',
  VENUE_JSON: venueJson,
  HOURS_LIST: hoursList,
  HOURS_SUMMARY: escapeHtml(hoursSummary(venue.hours)),
  HOURS_SENTENCE: escapeHtml(hoursSentence(venue.hours)),
  NEARBY_SUBURBS: escapeHtml(nearbySuburbs.slice(0, -1).join(', ') + ' and ' + nearbySuburbs[nearbySuburbs.length - 1]),
  FAQ_ITEMS: faqHtml,
  MENU_HIGHLIGHTS: menuHtml,
  BOOKING_CARD_CLASS: centralpassApiBase || bookingDemo ? ' is-connecting' : '',
  BOOKING_CREDIT_COPY: centralpassApiBase ? 'Bookings powered by' : bookingDemo ? 'Booking preview by' : 'Online booking page built by',
  ROBOTS_META: indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
  GEO_POSITION: geo.latitude + ';' + geo.longitude,
  GEO_ICBM: geo.latitude + ', ' + geo.longitude,
  SQUARE_URL: squareUrl,
  INSTAGRAM_URL: instagramUrl,
  FACEBOOK_URL: facebookUrl,
  UBER_EATS_URL: uberEatsUrl,
  MAPS_URL: escapeHtml(mapsUrl),
  VERSION: version,
};

for (const page of pages) {
  const body = await readFile(join('src', 'pages', page.key + '.html'), 'utf8');
  const canonicalUrl = publicOrigin + '/' + (page.slug ? page.slug + '/' : '');
  const activeNav = nav.split('data-nav="' + page.key + '"').join('data-nav="' + page.key + '" aria-current="page"');
  if (page.title.length > 62) console.warn('Warning: ' + page.key + ' title is ' + page.title.length + ' characters; search results may cut it off.');
  if (page.description.length > 165) console.warn('Warning: ' + page.key + ' description is ' + page.description.length + ' characters.');
  const preload = page.preload ? '<link rel="preload" as="image" type="image/webp" imagesrcset="' + webpSet(page.preload.name) + '" imagesizes="' + page.preload.sizes + '" fetchpriority="high" />' : '';
  const replacements = {
    TITLE: escapeHtml(page.title),
    DESCRIPTION: escapeHtml(page.description),
    OG_IMAGE: escapeHtml(publicOrigin + page.ogImage),
    OG_ALT: escapeHtml(page.ogAlt),
    OG_URL: escapeHtml(canonicalUrl),
    CANONICAL: '<link rel="canonical" href="' + escapeHtml(canonicalUrl) + '" />',
    PRELOAD: preload,
    STRUCTURED_DATA: structuredData(page, canonicalUrl),
    PAGE: page.key,
    NAV: activeNav,
    FOOTER: footer,
    BODY: body,
    PAGE_SCRIPTS: page.scripts || '',
    ...siteMarkers,
  };
  let html = layout;
  // Two passes so markers inside NAV, FOOTER, BODY and PAGE_SCRIPTS resolve too.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const [key, value] of Object.entries(replacements)) html = html.split('{{' + key + '}}').join(value);
  }
  html = responsiveImages(html.replace(/^[ \t]+$/gm, ''));
  if (html.includes('{{')) throw new Error('Unresolved template marker in ' + page.key + ': ' + html.match(/\{\{[A-Z_]+\}\}/)?.[0]);
  if ((html.match(/<h1\b/g) || []).length !== 1) throw new Error('Expected one H1 in ' + page.key);
  if (hardCodedVenue.test(body)) throw new Error('Hard-coded venue details in src/pages/' + page.key + '.html. Use the {{VENUE_*}} markers.');
  if (page.key === 'menu' && (!html.includes('menu-preview.svg') || /MENU PREVIEW · COMING SOON|Menu selection coming soon/.test(html))) {
    throw new Error('Menu image is missing or the old placeholder returned.');
  }
  const destination = page.slug ? join(page.slug, 'index.html') : 'index.html';
  if (page.slug) await mkdir(page.slug, { recursive: true });
  await writeFile(destination, html, 'utf8');
}

for (const redirect of redirects) {
  const target = escapeHtml(redirect.to);
  const canonical = escapeHtml(publicOrigin + redirect.to.split('#')[0]);
  await mkdir(redirect.slug, { recursive: true });
  await writeFile(join(redirect.slug, 'index.html'), '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Wild and The Sun</title><link rel="canonical" href="' + canonical + '"><meta http-equiv="refresh" content="0; url=' + target + '"></head><body><p><a href="' + target + '">Continue to Visit us</a></p></body></html>\n', 'utf8');
}

await writeFile('config.js', configJs, 'utf8');

for (const asset of ['assets/menu-preview.svg', 'assets/brand/centralpass-mark.svg', 'assets/brand/logo-wordmark.webp', 'assets/brand/logo-mark.webp', 'assets/fonts/fraunces-normal-latin.woff2', 'assets/fonts/fraunces-italic-latin.woff2', 'assets/fonts/dm-sans-normal-latin.woff2', 'assets/fonts/OFL-fraunces.txt', 'assets/fonts/OFL-dmsans.txt', 'assets/brand/favicon-64.png', 'assets/brand/official-logo-full.jpg', ...pages.map((page) => page.ogImage.slice(1)), 'config.js', 'venue.js', 'site.js', 'booking.js', 'design.css', ...(bookingDemo ? ['booking-demo.js'] : [])]) {
  await access(asset);
}

// Security headers for Cloudflare Pages. The CSP allows scripts only from this
// site plus the one inline bootstrap line, and network calls only to this site
// and the CentralPass API.
const inlineScripts = [...layout.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => "'sha256-" + createHash('sha256').update(match[1]).digest('base64') + "'");
const csp = [
  "default-src 'self'",
  "script-src 'self' " + inlineScripts.join(' '),
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'" + (centralpassApiBase ? ' ' + centralpassApiBase : ''),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');
const headers = ['/*',
  '  Content-Security-Policy: ' + csp,
  '  X-Content-Type-Options: nosniff',
  '  X-Frame-Options: DENY',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()',
  '  Strict-Transport-Security: max-age=31536000',
  '  Cross-Origin-Opener-Policy: same-origin',
  ...(indexable ? [] : ['  X-Robots-Tag: noindex, nofollow']),
  '',
  '/assets/*',
  '  Cache-Control: public, max-age=604800',
  '',
  ...['/design.css', '/site.js', '/venue.js', '/booking.js', '/booking-demo.js', '/config.js'].flatMap((path) => [path, '  Cache-Control: public, max-age=31536000, immutable', '']),
  '',
  '/llms.txt',
  '  Content-Type: text/plain; charset=utf-8',
  ''].join('\n');
await writeFile('_headers', headers, 'utf8');

// Search and AI crawlers are named explicitly so the welcome is unambiguous.
const aiCrawlers = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'Googlebot', 'CCBot', 'DuckAssistBot', 'Meta-ExternalAgent'];
await writeFile('robots.txt', indexable
  ? '# Everyone is welcome, including AI search and assistant crawlers.\nUser-agent: *\nAllow: /\n\n' + aiCrawlers.map((bot) => 'User-agent: ' + bot + '\nAllow: /').join('\n\n') + '\n\nSitemap: ' + publicOrigin + '/sitemap.xml\n'
  : '# Not launched yet: this build asks crawlers to stay away.\nUser-agent: *\nDisallow: /\n', 'utf8');

// Image sitemap entries help photo search and AI answers show the right pictures.
const sitemapImages = {
  home: ['client/acai-trio', 'client/berry-choc', 'client/chocolate-acai-cups', 'client/smoothie-trio', 'client/latte', 'client/gourmet-sando', 'client/specialty-pair', 'graphic/family-instagram'],
  menu: ['client/berry-choc', 'client/chocolate-acai-cups', 'client/specialty-pair', 'client/smoothie-trio', 'client/latte'],
  visit: ['graphic/family-instagram', 'client/acai-trio', 'client/latte'],
  book: ['client/specialty-pair'],
};
const urls = pages.map((page) => {
  const loc = publicOrigin + '/' + (page.slug ? page.slug + '/' : '');
  const images = (sitemapImages[page.key] || []).map((name) => '<image:image><image:loc>' + escapeHtml(publicOrigin + '/assets/' + name + '-' + fullWidth(name) + '.webp') + '</image:loc></image:image>').join('');
  return '  <url><loc>' + escapeHtml(loc) + '</loc>' + images + '</url>';
}).join('\n');
await writeFile('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + urls + '\n</urlset>\n', 'utf8');

// llms.txt: a plain summary for AI assistants (llmstxt.org), from the same data.
const llms = [
  '# ' + venue.name,
  '',
  '> Family-run açaí café inside Aberfoyle Hub Shopping Centre, Aberfoyle Park, South Australia, in Adelaide’s southern suburbs. Açaí bowls, smoothies, specialty coffee, pastries and café food. Dine in, order ahead for pickup, get delivery, or book a table.',
  '',
  '## Key facts',
  '',
  '- Name: ' + venue.name + ' (also written Wild and the Sun Acai Cafe, Wild & The Sun)',
  '- Address: ' + flatAddress + ', Australia. Inside Aberfoyle Hub Shopping Centre (corner Hub Drive and Sandpiper Crescent), near Woolworths.',
  '- Nearby suburbs: ' + nearbySuburbs.join(', ') + '. City of Onkaparinga, about 20 km south of Adelaide CBD.',
  '- Phone: ' + venue.phone,
  ...(venue.email ? ['- Email: ' + venue.email] : []),
  '- Opening hours: ' + hoursSentence(venue.hours) + '. Public holiday hours can vary.',
  '- Known for: açaí bowls (Classic Açaí Bowl with banana, strawberry, granola and honey; Kids Açaí Bowl), pistachio latte, Dubai chocolate croissant, loaded banana bread, waffles.',
  '- Type: café, açaí bar and coffee shop. Family run. Dine in and takeaway.',
  '- Book a table: ' + (onlineBooking ? publicOrigin + '/book/ or call ' + venue.phone : 'call ' + venue.phone + ' (see ' + publicOrigin + '/book/)'),
  '- Order ahead for pickup: ' + squareUrl,
  '- Delivery: Uber Eats, ' + uberEatsUrl,
  '- Instagram: ' + instagramUrl,
  '- Facebook: ' + facebookUrl,
  '',
  '## Menu highlights',
  '',
  'Current items and prices are on the online ordering store. Highlights:',
  '',
  ...menu.sections.flatMap((section) => ['### ' + section.name, '', section.description, '', ...section.items.map((item) => '- ' + item.name + ': ' + item.description), '']),
  '## Frequently asked questions',
  '',
  ...faqs.flatMap((item) => ['### ' + item.q, '', item.a, '']),
  '## Pages',
  '',
  ...pages.map((page) => '- [' + page.crumb + '](' + publicOrigin + '/' + (page.slug ? page.slug + '/' : '') + '): ' + page.description),
  '',
].join('\n');
await writeFile('llms.txt', llms, 'utf8');

await writeFile('404.html', '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found | Wild and The Sun</title><link rel="icon" href="/assets/brand/favicon-64.png" type="image/png"><link rel="stylesheet" href="/design.css?v=' + version + '"></head><body class="page-404"><main class="not-found"><div class="sun sun-static" aria-hidden="true"></div><h1>Lost your <em>way?</em></h1><p>This page doesn’t exist. Let’s get you back to the good stuff.</p><a class="btn btn-primary" href="/">Go to the homepage</a></main></body></html>\n', 'utf8');

console.log('Built ' + pages.length + ' pages' + (indexable ? ' (indexable)' : ' (noindex)') + '. Venue details and hours from ' + venueSource + '. ' + (centralpassApiBase ? 'Live CentralPass bookings at ' + centralpassApiBase + '.' : bookingDemo ? 'PREVIEW booking demo with sample data (BOOKING_DEMO=true).' : 'No CENTRALPASS_API_BASE: phone-booking fallback.'));
