(() => {
  'use strict';
  const root = document.getElementById('party-planner');
  if (!root) return;
  const partyButtons = [...root.querySelectorAll('[data-party]')];
  const menuRequest = root.querySelector('[data-menu-request]');
  const details = root.querySelector('[data-details]');
  const guests = root.querySelector('[data-guests]');
  const date = root.querySelector('[data-date]');
  const send = root.querySelector('[data-planner-send]');
  let party = 'High tea';

  function update() {
    const ticketParty = root.querySelector('[data-ticket-party]');
    const ticketGuests = root.querySelector('[data-ticket-guests]');
    const ticketDate = root.querySelector('[data-ticket-date]');
    if (ticketParty) ticketParty.textContent = party;
    if (ticketGuests) ticketGuests.textContent = guests.value.trim() || 'Your guest count';
    if (ticketDate) ticketDate.textContent = date.value || 'Choose a date';
    const message = ['Hello Wild & The Sun, I would like to plan a venue-hire celebration.', '', `Occasion: ${party}`, `Expected guests: ${guests.value.trim() || 'To be confirmed'}`, `Preferred date: ${date.value || 'To be confirmed'}`, `Menu requests: ${menuRequest.value.trim() || 'To be discussed'}`, `Other details: ${details.value.trim() || 'None specified'}`].join('\n');
    send.href = `https://wa.me/61451661351?text=${encodeURIComponent(message)}`;
  }

  partyButtons.forEach((button) => button.addEventListener('click', () => {
    partyButtons.forEach((item) => { item.classList.toggle('is-active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
    party = button.dataset.label;
    update();
  }));
  menuRequest.addEventListener('input', update);
  details.addEventListener('input', update);
  guests.addEventListener('input', update);
  date.addEventListener('change', update);
  date.min = new Date().toISOString().slice(0, 10);
  update();
})();
