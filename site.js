(() => {
  'use strict';

  // Old single-page anchors still arrive from shared links.
  const legacyRoutes = { '#about': '/visit/#story', '#favourites': '/menu/', '#visit': '/visit/', '#book': '/book/' };
  if (['/', '/index.html'].includes(location.pathname) && legacyRoutes[location.hash]) {
    location.replace(legacyRoutes[location.hash]);
    return;
  }

  const html = document.documentElement;
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

  // Show the events invitation once per browser session, on whichever page
  // someone visits first. Native dialog handles Escape and focus trapping.
  const occasionDialog = document.getElementById('occasion-dialog');
  if (occasionDialog && typeof occasionDialog.showModal === 'function') {
    occasionDialog.querySelectorAll('[data-dialog-close]').forEach((button) => {
      button.addEventListener('click', () => occasionDialog.close());
    });
    occasionDialog.addEventListener('click', (event) => {
      if (event.target === occasionDialog) occasionDialog.close();
    });
    let seen = false;
    try { seen = sessionStorage.getItem('wildsun:events-invitation') === 'seen'; } catch (_) { /* Storage may be unavailable. */ }
    if (!seen) {
      setTimeout(() => {
        if (occasionDialog.open) return;
        occasionDialog.showModal();
        try { sessionStorage.setItem('wildsun:events-invitation', 'seen'); } catch (_) { /* The invitation still works. */ }
      }, 1400);
    }
  }

  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.getElementById('primary-nav');

  function setMenu(open, { restoreFocus = true } = {}) {
    if (!menuButton || !menu) return;
    menuButton.setAttribute('aria-expanded', String(open));
    html.classList.toggle('menu-open', open);
    menu.classList.toggle('is-open', open);
    // Screen readers should not wander into the page behind the open menu.
    document.querySelectorAll('main, .site-footer').forEach((element) => { element.inert = open; });
    if (open) menu.querySelector('a')?.focus({ preventScroll: true });
    else if (restoreFocus) menuButton.focus({ preventScroll: true });
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
  matchMedia('(max-width: 900px)').addEventListener?.('change', (event) => {
    if (!event.matches && html.classList.contains('menu-open')) setMenu(false, { restoreFocus: false });
  });

  // Pause the review ribbon while it is off-screen to save battery.
  if ('IntersectionObserver' in window) {
    const offscreen = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-offscreen', !entry.isIntersecting));
    }, { rootMargin: '120px 0px' });
    document.querySelectorAll('[data-hero], .ribbons, .story-teaser, .book-cta').forEach((element) => offscreen.observe(element));
  }

  html.classList.add('is-ready');
})();
