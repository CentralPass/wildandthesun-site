(() => {
  'use strict';
  const root = document.getElementById('party-planner');
  if (!root) return;
  const partyButtons = [...root.querySelectorAll('[data-party]')];
  const touchButtons = [...root.querySelectorAll('[data-touch]')];
  const scene = root.querySelector('[data-party-scene]');
  const guests = root.querySelector('[data-guests]');
  const date = root.querySelector('[data-date]');
  const send = root.querySelector('[data-planner-send]');
  let party = 'High tea';

  function renderSeats() {
    const holder = root.querySelector('[data-party-seats]');
    holder.replaceChildren(...Array.from({ length: Math.min(Number(guests.value), 18) }, () => document.createElement('i')));
  }

  function update() {
    root.querySelector('[data-ticket-party]').textContent = party;
    root.querySelector('[data-ticket-guests]').textContent = guests.value;
    root.querySelector('[data-guest-output]').textContent = guests.value;
    root.querySelector('[data-ticket-date]').textContent = date.value || 'Choose a date';
    renderSeats();
    const ideas = touchButtons.filter((button) => button.classList.contains('is-active')).map((button) => button.dataset.touch);
    const message = ['Hello Wild & The Sun, I would like to plan a venue-hire celebration.', '', `Occasion: ${party}`, `Guests: approximately ${guests.value}`, `Preferred date: ${date.value || 'To be confirmed'}`, `Menu ideas: ${ideas.length ? ideas.join(', ') : 'Open to suggestions'}`].join('\n');
    send.href = `https://wa.me/61451661351?text=${encodeURIComponent(message)}`;
  }

  partyButtons.forEach((button) => button.addEventListener('click', () => {
    partyButtons.forEach((item) => { item.classList.toggle('is-active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
    party = button.dataset.label;
    scene.src = button.dataset.image;
    scene.alt = `${party} table illustration`;
    update();
  }));
  touchButtons.forEach((button) => button.addEventListener('click', () => {
    const active = button.classList.toggle('is-active');
    button.setAttribute('aria-pressed', String(active));
    update();
  }));
  guests.addEventListener('input', update);
  date.addEventListener('change', update);
  date.min = new Date().toISOString().slice(0, 10);
  update();
})();
