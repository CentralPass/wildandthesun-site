(() => {
  'use strict';

  const legacyRoutes = {
    '#about': '/story/',
    '#favourites': '/menu/',
    '#visit': '/visit/',
    '#book': '/book/',
  };
  if (['/', '/index.html'].includes(location.pathname) && legacyRoutes[location.hash]) {
    location.replace(legacyRoutes[location.hash]);
    return;
  }

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.getElementById('primary-nav');
  const mobileDock = document.getElementById('mobile-dock');
  const mobileScreen = matchMedia('(max-width: 760px)');
  let pastHero = false;

  function updateDock() {
    if (!mobileDock || !menuButton) return;
    mobileDock.classList.toggle('is-visible', mobileScreen.matches && pastHero && menuButton.getAttribute('aria-expanded') !== 'true');
  }

  function setMenu(open) {
    if (!menuButton || !menu) return;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    updateDock();
  }

  menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuButton.focus();
    }
  });
  mobileScreen.addEventListener?.('change', () => { if (!mobileScreen.matches) setMenu(false); updateDock(); });

  const hero = document.getElementById('top');
  if ('IntersectionObserver' in window && hero) {
    const heroObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      pastHero = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
      updateDock();
    });
    heroObserver.observe(hero);
  }

  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('motion-ready');
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -32px 0px', threshold: 0.08 });
    document.querySelectorAll('[data-reveal]').forEach((element) => revealObserver.observe(element));
  }

  const progress = document.querySelector('.reading-progress');
  if (progress) {
    let ticking = false;
    const updateProgress = () => {
      const total = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      progress.style.transform = `scaleX(${Math.min(1, scrollY / total)})`;
      ticking = false;
    };
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateProgress);
    }, { passive: true });
    updateProgress();
  }

  const explorer = document.querySelector('[data-menu-explorer]');
  if (explorer) {
    const tabs = [...explorer.querySelectorAll('[role="tab"]')];
    const panels = [...explorer.querySelectorAll('[role="tabpanel"]')];
    function activate(tab, focus = false) {
      const key = tab.dataset.tab;
      tabs.forEach((item) => {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== key; });
      if (focus) tab.focus();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', (event) => {
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        activate(tabs[next], true);
      });
    });
  }

  const heroVisual = document.querySelector('.hero-visual');
  if (heroVisual && matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches) {
    heroVisual.addEventListener('pointermove', (event) => {
      const bounds = heroVisual.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      heroVisual.style.setProperty('--move-x', `${x * 12}px`);
      heroVisual.style.setProperty('--move-y', `${y * 12}px`);
    });
    heroVisual.addEventListener('pointerleave', () => {
      heroVisual.style.setProperty('--move-x', '0px');
      heroVisual.style.setProperty('--move-y', '0px');
    });
  }
})();
