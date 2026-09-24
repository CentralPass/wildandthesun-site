import { mkdir, writeFile } from 'node:fs/promises';

const squareUrl = 'https://wild-and-the-sun.square.site/s/order#most-popular';
const directionsUrl = 'https://www.google.com/maps/dir/?api=1&destination=Wild+and+the+Sun+Acai+Cafe%2C+Shop+4%2C+130-150+Hub+Drive%2C+Aberfoyle+Park+SA+5159';

const image = (src, alt, className = '', extra = '') =>
  `<img class="${className}" src="/assets/${src}" alt="${alt}" ${extra} />`;
const arrow = '<span class="link-arrow" aria-hidden="true"></span>';
const squareLink = (label = 'Order online', className = 'button button-light') =>
  `<a class="${className}" href="${squareUrl}" target="_blank" rel="noopener noreferrer">${label}${arrow}</a>`;

const navItems = [
  ['home', '/', 'Home'],
  ['menu', '/menu/', 'Menu'],
  ['story', '/story/', 'Our story'],
  ['visit', '/visit/', 'Visit'],
  ['book', '/book/', 'Book a table'],
];

function layout({ page, title, description, content, preload, booking = false }) {
  const nav = navItems.map(([key, href, label]) =>
    `<a href="${href}"${key === page ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#f5f0e8" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <meta name="description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_AU" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta name="twitter:card" content="summary" />
  <title>${title}</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&amp;family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400;1,9..144,500&amp;display=swap" rel="stylesheet" />
  ${preload ? `<link rel="preload" href="/assets/${preload}" as="image" fetchpriority="high" />` : ''}
  <link rel="stylesheet" href="/design.css" />
  ${booking ? '<script src="/config.js" defer></script>\n  <script src="/booking.js" defer></script>' : '<script src="/site.js" defer></script>'}
</head>
<body class="page-${page}">
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="topline"><span>Wild and The Sun Açaí Cafe</span><span>Aberfoyle Park, South Australia</span></div>
  <header class="site-header">
    <a class="brand" href="/" aria-label="Wild and The Sun home"><span class="brand-sun" aria-hidden="true"></span><span class="brand-type">wild <i>&amp;</i> the sun<small>AÇAÍ CAFE</small></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Open menu"><span></span><span></span></button>
    <nav class="primary-nav" id="primary-nav" aria-label="Main navigation">${nav}<a class="mobile-order-link" href="${squareUrl}" target="_blank" rel="noopener noreferrer">Order online</a></nav>
    ${squareLink('Order online', 'header-order')}
  </header>
  <div class="reading-progress" aria-hidden="true"></div>
  <main id="main">${content}</main>
  <footer class="site-footer">
    <div class="footer-main layout-wrap">
      <div class="footer-lead"><span class="eyebrow">YOUR SUNNY SPOT</span><a class="footer-wordmark" href="/">wild <i>&amp;</i> the sun</a><p>Açaí, coffee and a little time for yourself in Aberfoyle Park.</p></div>
      <div class="footer-column"><h2>Explore</h2><a href="/menu/">Menu</a><a href="/story/">Our story</a><a href="/book/">Book a table</a><a href="/visit/">Visit us</a></div>
      <div class="footer-column"><h2>Find us</h2><p>Shop 4, Aberfoyle Hub<br />130-150 Hub Drive<br />Aberfoyle Park SA 5159</p><a href="tel:+61451661351">0451 661 351</a><a href="${directionsUrl}" target="_blank" rel="noopener noreferrer">Get directions</a></div>
    </div>
    <div class="footer-bottom layout-wrap"><span>© <span id="year"></span> Wild and The Sun Açaí Cafe</span><span>Preview photography is illustrative until venue images are supplied.</span></div>
  </footer>
  <div class="mobile-dock" id="mobile-dock" aria-label="Quick actions"><a href="/book/">Book a table</a><a href="${squareUrl}" target="_blank" rel="noopener noreferrer">Order online</a></div>
</body>
</html>`;
}

const home = layout({
  page: 'home',
  title: 'Wild and The Sun Açaí Cafe | Aberfoyle Park',
  description: 'Bright açaí bowls, coffee, smoothies and something sweet at Wild and The Sun Açaí Cafe in Aberfoyle Park. Explore the menu, book a table or order online.',
  preload: 'scene-hero.webp',
  content: `
  <section class="home-hero" id="top" aria-labelledby="home-title">
    <div class="hero-copy" data-reveal>
      <span class="eyebrow"><span class="eyebrow-line"></span> ABERFOYLE PARK, SA</span>
      <h1 id="home-title">A little<br /><em>wild.</em> A lot<br />of <span class="underline-word">sunshine.</span></h1>
      <p>Colourful açaí, really good drinks and a warm welcome. Find your favourite part of the day right here at the Hub.</p>
      <div class="button-row"><a class="button button-dark" href="/menu/">Explore the menu${arrow}</a><a class="button button-text" href="/book/">Book a table${arrow}</a></div>
      <div class="hero-bottom-note"><span>01 / AÇAÍ CAFE</span><span>OPEN TUESDAY TO SUNDAY</span></div>
    </div>
    <div class="hero-visual">
      <div class="hero-image-stage">
        ${image('scene-hero.webp', 'Illustrative açaí bowl with fruit and an iced matcha on a sunny table', 'hero-shot hero-shot-main', 'width="1122" height="1402" fetchpriority="high"')}
        ${image('scene-bowls.webp', '', 'hero-shot hero-shot-second', 'width="1536" height="1024" aria-hidden="true"')}
      </div>
      <div class="hero-orbit" aria-hidden="true"><svg viewBox="0 0 160 160"><defs><path id="orbit-path" d="M80,80 m-60,0 a60,60 0 1,1 120,0 a60,60 0 1,1 -120,0" /></defs><text><textPath href="#orbit-path">GOOD FOOD  /  GOOD DAYS  /  GOOD FOOD  /  GOOD DAYS  /  </textPath></text></svg><span class="orbit-core"></span></div>
      <span class="photo-corner">A BRIGHTER KIND OF BREAK</span>
    </div>
  </section>
  <div class="ticker" aria-label="Açaí, coffee and sweet treats"><div class="ticker-track" aria-hidden="true"><span>AÇAÍ / COFFEE / SOMETHING SWEET / AÇAÍ / COFFEE / SOMETHING SWEET / </span><span>AÇAÍ / COFFEE / SOMETHING SWEET / AÇAÍ / COFFEE / SOMETHING SWEET / </span></div></div>
  <section class="home-intro layout-wrap" aria-labelledby="intro-title"><div class="section-number">01 / COME ON IN</div><div data-reveal><h2 id="intro-title">For the quick stop.<br /><em>For the long catch up.</em></h2><p>Whether you are here for a cold açaí bowl, a coffee with a friend or a little treat, there is always a good reason to stay a while.</p></div></section>
  <section class="editorial-grid layout-wrap" aria-label="Explore Wild and The Sun">
    <a class="editorial-card card-tall" href="/menu/" data-reveal><div class="image-clip">${image('scene-bowls.webp', 'Illustrative pair of fruit topped açaí bowls', '', 'width="1536" height="1024" loading="lazy"')}</div><div class="editorial-meta"><span>01 / THE MENU</span><h3>Made to brighten your day.</h3><span class="card-link">See what we serve${arrow}</span></div></a>
    <a class="editorial-card card-offset" href="/story/" data-reveal><div class="image-clip">${image('scene-interior.webp', 'Illustrative warm café interior', '', 'width="1536" height="1024" loading="lazy"')}</div><div class="editorial-meta"><span>02 / OUR STORY</span><h3>Your new favourite pause.</h3><span class="card-link">Get to know us${arrow}</span></div></a>
    <a class="editorial-card card-small" href="/visit/" data-reveal><div class="image-clip">${image('scene-drinks.webp', 'Illustrative smoothie and coffee on a café table', '', 'width="1122" height="1402" loading="lazy"')}</div><div class="editorial-meta"><span>03 / FIND US</span><h3>Right here at the Hub.</h3><span class="card-link">Plan your visit${arrow}</span></div></a>
  </section>
  <section class="home-booking-band" aria-labelledby="home-booking-title"><div class="layout-wrap home-booking-inner"><div><span class="eyebrow">MAKE A LITTLE TIME</span><h2 id="home-booking-title">Pull up a chair.<br /><em>Stay for a while.</em></h2></div><div><p>Planning a catch up? Give us a call to book your table. Online bookings will follow when the venue system is ready.</p><a class="button button-cream" href="/book/">Book a table${arrow}</a></div></div></section>`
});

const menu = layout({
  page: 'menu',
  title: 'Menu | Wild and The Sun Açaí Cafe',
  description: 'Explore açaí bowls, coffee, smoothies and sweet treats at Wild and The Sun in Aberfoyle Park. View the current menu and order online through Square.',
  preload: 'scene-bowls.webp',
  content: `
  <section class="inner-hero menu-hero" id="top" aria-labelledby="menu-title"><div class="inner-hero-copy" data-reveal><span class="eyebrow">THE GOOD STUFF / 01</span><h1 id="menu-title">Pick your<br /><em>happy place.</em></h1><p>Cold, colourful bowls. Drinks worth slowing down for. A little something sweet when the moment calls for it.</p>${squareLink('Order online', 'button button-dark')}</div><div class="inner-hero-media">${image('scene-bowls.webp', 'Illustrative açaí bowls with fruit, granola and pistachio', '', 'width="1536" height="1024" fetchpriority="high"')}<span class="media-index">AÇAÍ / COFFEE / TREATS</span></div></section>
  <section class="menu-intro layout-wrap" aria-labelledby="menu-intro-title"><span class="section-number">WHAT ARE YOU IN THE MOOD FOR?</span><h2 id="menu-intro-title">A little of this.<br /><em>A little of that.</em></h2><p>Explore a few favourites below, then visit our online menu for the full current selection and prices.</p></section>
  <section class="menu-explorer layout-wrap" aria-label="Explore our menu" data-menu-explorer>
    <div class="menu-tabs" role="tablist" aria-label="Menu categories"><button id="tab-acai" role="tab" aria-selected="true" aria-controls="panel-acai" tabindex="0" data-tab="acai"><span>01</span> Açaí bowls</button><button id="tab-drinks" role="tab" aria-selected="false" aria-controls="panel-drinks" tabindex="-1" data-tab="drinks"><span>02</span> Drinks</button><button id="tab-treats" role="tab" aria-selected="false" aria-controls="panel-treats" tabindex="-1" data-tab="treats"><span>03</span> Treats</button></div>
    <div class="menu-panel" id="panel-acai" role="tabpanel" aria-labelledby="tab-acai" data-panel="acai"><div class="menu-panel-copy"><span class="eyebrow">01 / THE BOWLS</span><h3>Açaí made for sunny days.</h3><p>Cool, rich açaí with fruit and all the little extras that make it yours. Our current Square menu includes a Classic Açaí Bowl and a Kids Açaí Bowl.</p>${squareLink('See the current menu', 'text-action')}</div><div class="menu-panel-photos">${image('acai-bowl-placeholder.webp', 'Illustrative açaí bowl topped with fruit and granola', '', 'width="1536" height="1024" loading="lazy"')}${image('scene-hero.webp', 'Illustrative açaí bowl and iced matcha in sunshine', '', 'width="1122" height="1402" loading="lazy"')}</div></div>
    <div class="menu-panel" id="panel-drinks" role="tabpanel" aria-labelledby="tab-drinks" data-panel="drinks" hidden><div class="menu-panel-copy"><span class="eyebrow">02 / THE SIPS</span><h3>Something good in every glass.</h3><p>Take your pick from coffee, smoothies and specialty drinks. See Square for the latest selection, including the café's current pistachio latte.</p>${squareLink('See the current menu', 'text-action')}</div><div class="menu-panel-photos">${image('scene-drinks.webp', 'Illustrative berry smoothie and flat white on a sunny table', '', 'width="1122" height="1402" loading="lazy"')}${image('drinks-placeholder.webp', 'Illustrative smoothie and iced green drink', '', 'width="1122" height="1402" loading="lazy"')}</div></div>
    <div class="menu-panel" id="panel-treats" role="tabpanel" aria-labelledby="tab-treats" data-panel="treats" hidden><div class="menu-panel-copy"><span class="eyebrow">03 / THE LITTLE EXTRAS</span><h3>Stay for something sweet.</h3><p>There is always room for a café treat. Browse the current selection on Square for bakes, banana bread and more.</p>${squareLink('See the current menu', 'text-action')}</div><div class="menu-panel-photos">${image('bakes-placeholder.webp', 'Illustrative pastries and coffee on a café table', '', 'width="1122" height="1402" loading="lazy"')}${image('scene-interior.webp', 'Illustrative pastry counter in a warm café', '', 'width="1536" height="1024" loading="lazy"')}</div></div>
  </section>
  <section class="menu-photo-strip layout-wrap" aria-label="Food and drinks gallery"><figure>${image('scene-bowls.webp', 'Illustrative pair of açaí bowls', '', 'width="1536" height="1024" loading="lazy"')}<figcaption>COLOURFUL BOWLS</figcaption></figure><figure>${image('scene-drinks.webp', 'Illustrative smoothie and coffee', '', 'width="1122" height="1402" loading="lazy"')}<figcaption>GOOD THINGS TO SIP</figcaption></figure><figure>${image('bakes-placeholder.webp', 'Illustrative baked café treats', '', 'width="1122" height="1402" loading="lazy"')}<figcaption>A LITTLE TREAT</figcaption></figure></section>
  <section class="simple-cta"><div class="layout-wrap"><span class="eyebrow">PICK YOUR FAVOURITE</span><h2>See the full menu<br /><em>when you are ready.</em></h2><p>Ordering takes place on the café's Square website.</p>${squareLink('Order online', 'button button-cream')}</div></section>`
});

const story = layout({
  page: 'story',
  title: 'Our Story | Wild and The Sun Açaí Cafe',
  description: 'Get to know Wild and The Sun, a warm local açaí café for colourful bowls, coffee and easy catch ups in Aberfoyle Park.',
  preload: 'scene-interior.webp',
  content: `
  <section class="story-hero" id="top" aria-labelledby="story-title"><div class="story-hero-copy layout-wrap" data-reveal><span class="eyebrow">THE PLACE BEHIND THE BOWLS / 02</span><h1 id="story-title">A little more<br />than a <em>café.</em></h1><p>Wild and The Sun is your local place to pause, catch up and enjoy something bright in Aberfoyle Park.</p></div><div class="story-hero-photo">${image('scene-interior.webp', 'Illustrative warm and welcoming café interior', '', 'width="1536" height="1024" fetchpriority="high"')}</div></section>
  <section class="story-statement layout-wrap" aria-labelledby="story-statement-title"><span class="section-number">01 / THE FEELING</span><div><h2 id="story-statement-title">Come as you are.<br /><em>Stay for the good stuff.</em></h2><p>We love the little moments that turn a quick visit into a better day. A favourite bowl. A drink in the sun. Time with someone you like.</p></div></section>
  <section class="story-collage layout-wrap" aria-label="Illustrative café moments"><div class="story-photo-one" data-reveal>${image('scene-hero.webp', 'Illustrative açaí bowl and iced matcha on a sunny table', '', 'width="1122" height="1402" loading="lazy"')}<span>01 / THE BOWL</span></div><div class="story-photo-two" data-reveal>${image('scene-drinks.webp', 'Illustrative smoothie and flat white in sunshine', '', 'width="1122" height="1402" loading="lazy"')}<span>02 / THE MOMENT</span></div><div class="story-note" data-reveal><span class="eyebrow">RIGHT HERE AT THE HUB</span><h3>Good food. Easy company. Your kind of day.</h3><a class="text-action" href="/visit/">Come say hello${arrow}</a></div></section>
  <section class="story-close"><div class="layout-wrap story-close-inner"><span class="eyebrow">THE NEXT GOOD THING</span><h2>Meet us for a bowl.</h2><div><a class="button button-dark" href="/menu/">Explore the menu${arrow}</a><a class="button button-text" href="/book/">Book a table${arrow}</a></div></div></section>`
});

const visit = layout({
  page: 'visit',
  title: 'Visit Us | Wild and The Sun Açaí Cafe Aberfoyle Park',
  description: 'Find Wild and The Sun Açaí Cafe at Shop 4, Aberfoyle Hub, 130-150 Hub Drive, Aberfoyle Park SA. See opening hours, phone number and directions.',
  preload: 'scene-drinks.webp',
  content: `
  <section class="inner-hero visit-hero" id="top" aria-labelledby="visit-title"><div class="inner-hero-copy" data-reveal><span class="eyebrow">FIND YOUR SUNNY SPOT / 03</span><h1 id="visit-title">Right around<br /><em>your corner.</em></h1><p>Find us at Aberfoyle Hub in Aberfoyle Park. Come for a bowl, catch up over coffee or pick up your favourites to go.</p><a class="button button-dark" href="${directionsUrl}" target="_blank" rel="noopener noreferrer">Get directions${arrow}</a></div><div class="inner-hero-media">${image('scene-drinks.webp', 'Illustrative café drinks in sunshine', '', 'width="1122" height="1402" fetchpriority="high"')}<span class="media-index">SEE YOU AT THE HUB</span></div></section>
  <section class="visit-details layout-wrap" aria-label="Location and hours"><div class="visit-detail-card"><span class="eyebrow">01 / WHERE</span><h2>Find us here.</h2><p>Wild and The Sun Açaí Cafe<br />Shop 4, Aberfoyle Hub Shopping Centre<br />130-150 Hub Drive<br />Aberfoyle Park SA 5159</p><a class="text-action" href="${directionsUrl}" target="_blank" rel="noopener noreferrer">Open directions${arrow}</a></div><div class="visit-detail-card"><span class="eyebrow">02 / WHEN</span><h2>See you soon.</h2><dl><div><dt>Tuesday to Saturday</dt><dd>9am to 5pm</dd></div><div><dt>Sunday</dt><dd>9am to 2pm</dd></div><div><dt>Monday</dt><dd>Closed</dd></div></dl><p>Hours may change on public holidays. Please check the café's current listing before visiting.</p></div><div class="visit-detail-card"><span class="eyebrow">03 / SAY HELLO</span><h2>Give us a call.</h2><p>Questions, a quick booking or just checking that we are open? We are happy to help.</p><a class="text-action" href="tel:+61451661351">0451 661 351${arrow}</a></div></section>
  <section class="visit-photo-feature" aria-labelledby="visit-photo-title">${image('scene-interior.webp', 'Illustrative café interior placeholder', '', 'width="1536" height="1024" loading="lazy"')}<div><span class="eyebrow">COME AS YOU ARE</span><h2 id="visit-photo-title">A little time<br /><em>well spent.</em></h2><a class="button button-cream" href="/book/">Book a table${arrow}</a></div></section>`
});

const book = layout({
  page: 'book',
  title: 'Book a Table | Wild and The Sun Açaí Cafe',
  description: 'Book a table at Wild and The Sun Açaí Cafe in Aberfoyle Park. Phone bookings are available now, with native CentralPass online booking coming soon.',
  preload: 'scene-hero.webp',
  booking: true,
  content: `
  <section class="book-hero" id="top" aria-labelledby="book-title"><div class="book-hero-copy layout-wrap" data-reveal><span class="eyebrow">PULL UP A CHAIR / 04</span><h1 id="book-title">Make room for<br /><em>the good times.</em></h1><p>A catch up, a slow morning or a little something to celebrate. We would love to see you.</p><a class="button button-dark" href="#book">Find your table${arrow}</a></div><div class="book-hero-photo">${image('scene-hero.webp', 'Illustrative açaí bowl on a sunny table', '', 'width="1122" height="1402" fetchpriority="high"')}</div></section>
  <section class="book-section layout-wrap" id="book" aria-labelledby="booking-section-title"><div class="book-intro" data-reveal><span class="eyebrow">TABLE BOOKINGS</span><h2 id="booking-section-title">Your seat is<br /><em>waiting.</em></h2><p id="booking-intro-copy">Call us to book a table. Online booking is coming soon.</p><div class="booking-aside"><span>WALK-INS</span><p>Walk-ins are always welcome when space is available.</p></div></div><div class="booking-panel" data-reveal><div class="booking-panel-head"><span class="eyebrow">SAVE YOUR SPOT</span><h3 id="booking-panel-title">Book by phone</h3><p id="booking-panel-copy">Phone bookings are available now.</p></div><div id="booking-root" aria-live="polite"><p class="booking-status">Loading booking options…</p></div></div></section>
  <section class="book-extra layout-wrap" aria-label="More ways to enjoy Wild and The Sun"><div class="book-extra-image">${image('scene-interior.webp', 'Illustrative café seating and counter', '', 'width="1536" height="1024" loading="lazy"')}</div><div><span class="eyebrow">MORE IN THE MOOD FOR TAKEAWAY?</span><h2>Take a little<br /><em>sunshine with you.</em></h2><p>Ordering is handled on the café's Square website. Browse the current menu and collect your favourites.</p>${squareLink('Order online', 'button button-dark')}</div></section>`
});

await writeFile('index.html', home);
for (const [folder, html] of [['menu', menu], ['story', story], ['visit', visit], ['book', book]]) {
  await mkdir(folder, { recursive: true });
  await writeFile(`${folder}/index.html`, html);
}
console.log('Built Home, Menu, Our Story, Visit and Book pages.');
