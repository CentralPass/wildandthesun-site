(() => {
  'use strict';
  const legacyRoutes = { '#about': '/story/', '#favourites': '/menu/', '#visit': '/visit/', '#book': '/book/' };
  if (['/', '/index.html'].includes(location.pathname) && legacyRoutes[location.hash]) { location.replace(legacyRoutes[location.hash]); return; }
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.getElementById('primary-nav');
  const dock = document.getElementById('mobile-dock');
  const mobile = matchMedia('(max-width: 780px)');
  let pastHero = false;
  function updateDock() { dock?.classList.toggle('is-visible', mobile.matches && pastHero && menuButton?.getAttribute('aria-expanded') !== 'true'); }
  function setMenu(open) {
    if (!menuButton || !menu) return;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('is-open', open);
    updateDock();
  }
  menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') { setMenu(false); menuButton.focus(); } });
  mobile.addEventListener?.('change', () => { if (!mobile.matches) setMenu(false); updateDock(); });
  const hero = document.getElementById('top');
  if ('IntersectionObserver' in window && hero) new IntersectionObserver((entries) => { const entry = entries[0]; pastHero = !entry.isIntersecting && entry.boundingClientRect.bottom < 0; updateDock(); }).observe(hero);
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('motion-ready');
    const observer = new IntersectionObserver((entries, active) => entries.forEach((entry) => { if (!entry.isIntersecting) return; entry.target.classList.add('is-revealed'); active.unobserve(entry.target); }), { rootMargin: '0px 0px -24px 0px', threshold: 0.08 });
    document.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));
  }
  const motionButton = document.querySelector('[data-motion-toggle]');
  motionButton?.addEventListener('click', () => {
    const paused = document.querySelector('.flavour-strip').classList.toggle('is-paused');
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? 'Play moving text' : 'Pause moving text');
    motionButton.textContent = paused ? 'Play' : 'Pause';
  });
})();
