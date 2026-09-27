(() => {
  'use strict';

  // Old single-page anchors still arrive from shared links.
  const legacyRoutes = { '#about': '/visit/#story', '#favourites': '/menu/', '#visit': '/visit/', '#book': '/book/' };
  if (['/', '/index.html'].includes(location.pathname) && legacyRoutes[location.hash]) {
    location.replace(legacyRoutes[location.hash]);
    return;
  }

  const html = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 900px)');

  document.querySelectorAll('[data-year]').forEach((element) => { element.textContent = String(new Date().getFullYear()); });

  // Motion preference: a per-visitor convenience, so browser storage is fine.
  const motionButtons = document.querySelectorAll('[data-motion-toggle]');
  function setMotionPaused(paused) {
    html.classList.toggle('motion-paused', paused);
    motionButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(paused));
      button.querySelector('[data-motion-label]').textContent = paused ? 'Play motion' : 'Pause motion';
    });
  }
  try { setMotionPaused(localStorage.getItem('wildsun:motion') === 'paused'); } catch (_) { setMotionPaused(false); }
  motionButtons.forEach((button) => button.addEventListener('click', () => {
    const paused = !html.classList.contains('motion-paused');
    setMotionPaused(paused);
    try { localStorage.setItem('wildsun:motion', paused ? 'paused' : 'playing'); } catch (_) { /* Not remembered; still applied. */ }
  }));

  // Header: transparent over the hero, solid once the page scrolls.
  const header = document.querySelector('[data-header]');
  const hero = document.querySelector('[data-hero]');
  const dock = document.getElementById('mobile-dock');
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.getElementById('primary-nav');
  let pastHero = false;

  function updateDock() {
    const show = mobile.matches && pastHero && !document.body.classList.contains('page-book') && !html.classList.contains('menu-open');
    dock?.classList.toggle('is-visible', show);
  }

  function setMenu(open, { restoreFocus = true } = {}) {
    if (!menuButton || !menu) return;
    menuButton.setAttribute('aria-expanded', String(open));
    html.classList.toggle('menu-open', open);
    menu.classList.toggle('is-open', open);
    // Screen readers should not wander into the page behind the open menu.
    document.querySelectorAll('main, .site-footer').forEach((element) => { element.inert = open; });
    if (open) menu.querySelector('a')?.focus({ preventScroll: true });
    else if (restoreFocus) menuButton.focus({ preventScroll: true });
    updateDock();
  }

  menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false, { restoreFocus: false })));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && html.classList.contains('menu-open')) setMenu(false);
    // Keep keyboard focus inside the open menu.
    if (event.key === 'Tab' && html.classList.contains('menu-open')) {
      const focusable = [menuButton, ...menu.querySelectorAll('a')];
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
    }
  });
  mobile.addEventListener?.('change', () => { if (!mobile.matches && html.classList.contains('menu-open')) setMenu(false, { restoreFocus: false }); updateDock(); });

  let ticking = false;
  const parallax = [...document.querySelectorAll('[data-parallax]')];
  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    header?.classList.toggle('is-scrolled', y > 12);
    if (!reducedMotion.matches && !html.classList.contains('motion-paused')) {
      parallax.forEach((element) => {
        const offset = Math.min(y, window.innerHeight) * -0.08;
        element.style.setProperty('--parallax', offset.toFixed(1) + 'px');
      });
    }
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window && hero) {
    new IntersectionObserver(([entry]) => { pastHero = !entry.isIntersecting && entry.boundingClientRect.bottom < 0; updateDock(); }).observe(hero);
  }

  // Reveal on scroll. Content is visible by default; this only adds polish.
  const reveals = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    html.classList.add('reveal-ready');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach((element) => {
      // Stagger siblings in the same grid.
      const siblings = element.parentElement ? [...element.parentElement.children].filter((child) => child.hasAttribute('data-reveal')) : [];
      element.style.setProperty('--reveal-delay', (Math.max(siblings.indexOf(element), 0) * 90) + 'ms');
      observer.observe(element);
    });
  }

  // Pointer tilt on favourite cards, for fine pointers only.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion.matches) {
    document.querySelectorAll('.fav-card a').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const box = card.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        card.style.setProperty('--tilt-x', (y * -6).toFixed(2) + 'deg');
        card.style.setProperty('--tilt-y', (x * 8).toFixed(2) + 'deg');
      });
      card.addEventListener('pointerleave', () => { card.style.removeProperty('--tilt-x'); card.style.removeProperty('--tilt-y'); });
    });
  }

  html.classList.add('is-ready');
})();
