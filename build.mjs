import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const publicOrigin = (process.env.PUBLIC_SITE_ORIGIN || 'https://wild-and-the-sun.pages.dev').replace(/\/+$/, '');
const squareUrl = 'https://wild-and-the-sun.square.site/s/order#most-popular';
const pages = [
  { slug: '', key: 'home', title: 'Wild and The Sun Açaí Cafe | Aberfoyle Park', description: 'Açaí bowls, specialty drinks and a warm welcome at Wild and The Sun in Aberfoyle Park. Find us, view the café menu or order online.', image: '/assets/client/acai-trio.jpg' },
  { slug: 'menu', key: 'menu', title: 'Menu | Wild and The Sun Açaí Cafe', description: 'View the Wild and The Sun café menu in Aberfoyle Park. Order current items online through the café’s Square store.', image: '/assets/client/berry-choc.jpg' },
  { slug: 'venue-hire', key: 'venue', title: 'Gather at Wild and The Sun | Aberfoyle Park', description: 'Planning a group catch-up or celebration? Ask the Wild and The Sun team about gathering at the café in Aberfoyle Park.', image: '/assets/graphic/family-instagram.webp' },
  { slug: 'story', key: 'story', title: 'Our Story | Wild and The Sun Açaí Cafe', description: 'Meet the family behind Wild and The Sun, a local açaí café in Aberfoyle Park.', image: '/assets/graphic/family-instagram.webp' },
  { slug: 'visit', key: 'visit', title: 'Visit Wild and The Sun | Aberfoyle Park', description: 'Find Wild and The Sun at Aberfoyle Hub. See the café address, opening hours, phone number and directions.', image: '/assets/graphic/family-instagram.webp' },
  { slug: 'book', key: 'book', title: 'Book a Table | Wild and The Sun Açaí Cafe', description: 'Book a table at Wild and The Sun in Aberfoyle Park. Call the café to reserve a spot, or use live table bookings when available.', image: '/assets/client/specialty-pair.jpg', scripts: '<script src="/booking.js" defer></script>' },
];

const [layout, nav, footer] = await Promise.all([
  readFile('src/layout.html', 'utf8'),
  readFile('src/nav.html', 'utf8'),
  readFile('src/footer.html', 'utf8'),
]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

for (const page of pages) {
  const body = await readFile(join('src', 'pages', page.key + '.html'), 'utf8');
  const canonicalUrl = publicOrigin ? publicOrigin + '/' + (page.slug ? page.slug + '/' : '') : '';
  const activeNav = nav.replace('data-nav="' + page.key + '"', 'data-nav="' + page.key + '" aria-current="page"');
  const replacements = {
    TITLE: escapeHtml(page.title),
    DESCRIPTION: escapeHtml(page.description),
    OG_IMAGE: escapeHtml(publicOrigin + page.image),
    CANONICAL: canonicalUrl ? '<link rel="canonical" href="' + escapeHtml(canonicalUrl) + '" />' : '',
    PAGE: page.key,
    NAV: activeNav,
    FOOTER: footer,
    BODY: body,
    SQUARE_URL: squareUrl,
    PRELOAD: '<link rel="preload" href="' + page.image + '" as="image" fetchpriority="high" />',
    PAGE_SCRIPTS: page.scripts || '',
  };
  let html = layout;
  for (const [key, value] of Object.entries(replacements)) html = html.replaceAll('{{' + key + '}}', value);
  html = html.replace(/^[ \t]+$/gm, '');
  if (html.includes('{{')) throw new Error('Unresolved template marker in ' + page.key);
  if ((html.match(/<h1\b/g) || []).length !== 1) throw new Error('Expected one H1 in ' + page.key);
  if (page.key === 'menu' && (!html.includes('menu-preview.svg') || /MENU PREVIEW · COMING SOON|Menu selection coming soon/.test(html))) {
    throw new Error('Menu image is missing or the old placeholder returned.');
  }
  const destination = page.slug ? join(page.slug, 'index.html') : 'index.html';
  if (page.slug) await mkdir(page.slug, { recursive: true });
  await writeFile(destination, html, 'utf8');
}

for (const asset of ['assets/menu-preview.svg', 'assets/brand/official-logo-banner.jpg', 'assets/client/acai-trio.jpg', 'config.js', 'business-settings.js', 'site.js', 'booking.js', 'design.css']) {
  await access(asset);
}

if (publicOrigin) {
  const urls = pages.map((page) => '  <url><loc>' + escapeHtml(publicOrigin + '/' + (page.slug ? page.slug + '/' : '')) + '</loc></url>').join('\n');
  await writeFile('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n', 'utf8');
}

await writeFile('404.html', '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found | Wild and The Sun</title><link rel="stylesheet" href="/design.css"></head><body><main class="layout-wrap" style="min-height:80vh;display:flex;flex-direction:column;align-items:flex-start;justify-content:center"><p class="kicker">PAGE NOT FOUND</p><h1>Lost your way?</h1><p>Let’s get you back to the good stuff.</p><a class="button button-dark" href="/">Go to the homepage</a></main></body></html>', 'utf8');

console.log('Built six pages with a single menu image and Square ordering links.');
