(() => {
  'use strict';
  const menu = window.WILD_SUN_MENU || [];
  const index = document.getElementById('full-menu-index');
  const list = document.getElementById('full-menu-list');
  if (!index || !list) return;

  const orderUrl = 'https://wild-and-the-sun.square.site/s/order#most-popular';

  menu.forEach((category) => {
    const anchor = document.createElement('a');
    anchor.href = `#${category.id}`;
    anchor.textContent = category.title;
    index.append(anchor);

    const details = document.createElement('details');
    details.className = 'full-menu-category';
    details.id = category.id;
    details.open = category.id === 'patisserie';

    const summary = document.createElement('summary');
    const heading = document.createElement('div');
    heading.innerHTML = `<span>${category.number}</span><h2>${category.title}</h2><p>${category.subtitle}</p>`;
    const marker = document.createElement('i');
    marker.setAttribute('aria-hidden', 'true');
    summary.append(heading, marker);

    const items = document.createElement('ul');
    category.items.forEach((item) => {
      const row = document.createElement('li');
      const link = document.createElement('a');
      link.href = orderUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `Order ${item.name} on Square`);
      link.innerHTML = `<div class="full-menu-item-title"><h3>${item.name}</h3><i></i><strong>${item.price}</strong></div>${item.description ? `<p>${item.description}</p>` : ''}<div class="full-menu-item-meta">${item.note ? `<small>${item.note}</small>` : '<span></span>'}<b>Order on Square →</b></div>`;
      row.append(link);
      items.append(row);
    });
    details.append(summary, items);
    list.append(details);
  });
})();
