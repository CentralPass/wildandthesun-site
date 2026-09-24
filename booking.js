(() => {
  'use strict';

  const PHONE = '0451 661 351';
  const PHONE_HREF = 'tel:+61451661351';
  const root = document.getElementById('booking-root');
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.getElementById('primary-nav');
  const mobileDock = document.getElementById('mobile-dock');
  const mobileScreen = window.matchMedia('(max-width: 760px)');
  let pastHero = false;
  let bookingVisible = false;
  document.getElementById('year').textContent = new Date().getFullYear();

  function updateMobileDock() {
    mobileDock.classList.toggle('is-visible', mobileScreen.matches && pastHero && !bookingVisible && menuButton.getAttribute('aria-expanded') !== 'true');
  }

  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('is-open', open);
    updateMobileDock();
  });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    menu.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open menu');
    updateMobileDock();
  }));

  if ('IntersectionObserver' in window) {
    const dockObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target.id === 'top') pastHero = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
        if (entry.target.id === 'book') bookingVisible = entry.isIntersecting;
      });
      updateMobileDock();
    }, { threshold: 0 });
    dockObserver.observe(document.getElementById('top'));
    dockObserver.observe(document.getElementById('book'));

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('motion-ready');
      const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -24px 0px', threshold: 0.08 });
      document.querySelectorAll('[data-reveal]').forEach((element) => revealObserver.observe(element));
    }
  }
  mobileScreen.addEventListener?.('change', updateMobileDock);

  const configuredBase = String(window.WILD_SUN_CONFIG?.centralpassApiBase || '').trim().replace(/\/+$/, '');
  let apiBase = '';
  try {
    if (configuredBase) {
      const url = new URL(configuredBase);
      if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
        apiBase = url.href.replace(/\/+$/, '');
      }
    }
  } catch (_) { /* Invalid configuration is shown as the safe fallback below. */ }

  function showFallback(message) {
    root.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'booking-fallback';
    const explanation = document.createElement('p');
    explanation.textContent = message;
    const call = document.createElement('a');
    call.href = PHONE_HREF;
    call.textContent = `Call ${PHONE} to book a table`;
    box.append(explanation, call);
    root.append(box);
  }

  function showOnlineBookingMessage() {
    document.getElementById('booking-intro-copy').textContent = 'Meeting friends or taking a slow morning? We’d love to see you. Choose your date and party size to check live table availability.';
    document.getElementById('booking-panel-title').textContent = 'Find your table';
    document.getElementById('booking-panel-copy').textContent = 'Reservations are handled by CentralPass.';
  }

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `CentralPass returned ${response.status}.`);
    return payload;
  }

  function venueToday() {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function plusDays(dateString, days) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
  }

  function displayDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, day)));
  }

  function displayTime(time) {
    const [hour, minute] = time.split(':').map(Number);
    return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''}${hour >= 12 ? 'pm' : 'am'}`;
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function setText(selector, text) {
    const element = root.querySelector(selector);
    if (element) element.textContent = text;
  }

  function showBooking(config) {
    const maxParty = Math.min(Math.max(Number(config.max_party_size) || 12, 1), 100);
    const maxDays = Math.min(Math.max(Number(config.max_days_ahead) || 60, 1), 365);
    const today = venueToday();
    const deposit = config.deposits || {};
    let selectedTime = '';
    let requestId = null;
    let availabilityController = null;
    let loading = false;

    root.innerHTML = `
      <form class="booking-form" id="booking-form">
        <div class="form-row">
          <label class="form-field"><span>Guests</span><select id="booking-party" required></select></label>
          <label class="form-field"><span>Date</span><input id="booking-date" type="date" required></label>
        </div>
        <div><p class="form-title">Available times</p><div id="booking-times" class="times" role="group" aria-label="Available booking times"></div><p class="form-help" id="booking-time-help" role="status">Checking available tables…</p></div>
        <div id="booking-details" hidden>
          <hr class="booking-divider" />
          <p class="form-title">Your details</p>
          <div class="form-row">
            <label class="form-field"><span>Name</span><input id="booking-name" name="name" type="text" autocomplete="name" maxlength="120" required></label>
            <label class="form-field"><span>Phone</span><input id="booking-phone" name="phone" type="tel" autocomplete="tel" minlength="6" maxlength="30" required></label>
          </div>
          <label class="form-field"><span>Email for updates (optional)</span><input id="booking-email" name="email" type="email" autocomplete="email"></label>
          <label class="form-field"><span>Anything we should know? (optional)</span><textarea id="booking-notes" name="notes" maxlength="500" rows="2" placeholder="Accessibility needs, a celebration, or a high chair…"></textarea></label>
          <div id="booking-deposit" hidden><p class="form-help" id="booking-deposit-copy"></p><label class="booking-policy"><input id="booking-deposit-accept" type="checkbox"><span>I agree to this deposit policy and understand that payment is needed to hold the table.</span></label></div>
          <p class="booking-error" id="booking-error" role="alert" hidden></p>
          <button class="booking-submit" id="booking-submit" type="submit">Request this table</button>
        </div>
      </form>`;

    const form = root.querySelector('#booking-form');
    const partyInput = root.querySelector('#booking-party');
    const dateInput = root.querySelector('#booking-date');
    const times = root.querySelector('#booking-times');
    const details = root.querySelector('#booking-details');
    const help = root.querySelector('#booking-time-help');
    const error = root.querySelector('#booking-error');
    const submit = root.querySelector('#booking-submit');
    const depositBox = root.querySelector('#booking-deposit');

    for (let number = 1; number <= maxParty; number += 1) {
      const option = document.createElement('option');
      option.value = String(number);
      option.textContent = `${number} ${number === 1 ? 'guest' : 'guests'}`;
      partyInput.append(option);
    }
    const groupOption = document.createElement('option');
    groupOption.value = 'large';
    groupOption.textContent = `More than ${maxParty}`;
    partyInput.append(groupOption);
    partyInput.value = String(Math.min(2, maxParty));
    dateInput.min = today;
    dateInput.max = plusDays(today, maxDays);
    dateInput.value = today;

    function clearChoice() {
      selectedTime = '';
      requestId = null;
      details.hidden = true;
      error.hidden = true;
    }

    function updateDeposit() {
      const applies = deposit.deposit_enabled && Number(partyInput.value) >= Number(deposit.deposit_min_party);
      depositBox.hidden = !applies;
      if (!applies) return;
      const amount = Number(deposit.deposit_amount_cents) * (deposit.deposit_basis === 'per_person' ? Number(partyInput.value) : 1) / 100;
      const refund = Number(deposit.deposit_refund_hours);
      setText('#booking-deposit-copy', `A $${amount.toFixed(2)} deposit is required for this party. It is credited against your bill. Cancel at least ${refund} hours before your booking for a full refund; later cancellations retain the deposit. If the venue cancels, it is refunded.`);
    }

    async function loadAvailability() {
      if (availabilityController) availabilityController.abort();
      clearChoice();
      times.replaceChildren();
      if (partyInput.value === 'large') {
        help.innerHTML = '';
        const text = document.createElement('span');
        text.textContent = `For groups over ${maxParty}, please call us on `;
        const link = document.createElement('a');
        link.href = PHONE_HREF;
        link.textContent = PHONE;
        help.append(text, link, document.createTextNode('.'));
        return;
      }
      if (!dateInput.value) { help.textContent = 'Choose a date to see times.'; return; }
      availabilityController = new AbortController();
      const controller = availabilityController;
      loading = true;
      help.textContent = 'Checking available tables…';
      try {
        const query = new URLSearchParams({ date: dateInput.value, party_size: partyInput.value });
        const result = await request(`/api/bookings/availability?${query}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const slots = Array.isArray(result.slots) ? result.slots : [];
        const available = slots.filter((slot) => slot.available && Number(slot.seats_left) >= Number(partyInput.value) && /^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time));
        if (!available.length) {
          help.textContent = result.reason || 'No tables are available for this date and party size. Please try another day or call us.';
        } else {
          help.textContent = 'Select a time to continue.';
          available.forEach((slot) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'time-button';
            button.textContent = displayTime(slot.time);
            button.setAttribute('aria-pressed', 'false');
            button.addEventListener('click', () => {
              times.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', 'false'));
              button.setAttribute('aria-pressed', 'true');
              selectedTime = slot.time;
              requestId = null;
              details.hidden = false;
              updateDeposit();
              error.hidden = true;
            });
            times.append(button);
          });
        }
      } catch (cause) {
        if (cause.name !== 'AbortError') help.textContent = 'Live availability is unavailable right now. Please call us to book.';
      } finally {
        if (availabilityController === controller) loading = false;
      }
    }

    partyInput.addEventListener('change', loadAvailability);
    dateInput.addEventListener('change', loadAvailability);
    form.querySelectorAll('#booking-name,#booking-phone,#booking-email,#booking-notes,#booking-deposit-accept').forEach((input) => {
      input.addEventListener('input', () => { requestId = null; });
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (loading || !selectedTime || !form.reportValidity()) return;
      const depositApplies = !depositBox.hidden;
      if (depositApplies && !root.querySelector('#booking-deposit-accept').checked) {
        error.textContent = 'Please review and accept the deposit policy to continue.';
        error.hidden = false;
        return;
      }
      if (!requestId) requestId = uuid();
      submit.disabled = true;
      submit.textContent = 'Sending your request…';
      error.hidden = true;
      const payload = {
        date: dateInput.value,
        time: selectedTime,
        party_size: Number(partyInput.value),
        name: root.querySelector('#booking-name').value.trim(),
        phone: root.querySelector('#booking-phone').value.trim(),
        email: root.querySelector('#booking-email').value.trim() || undefined,
        notes: root.querySelector('#booking-notes').value.trim() || undefined,
        request_id: requestId,
        ...(depositApplies ? { accept_deposit_policy: true, deposit_policy_version: Number(deposit.deposit_version) } : {}),
      };
      try {
        const booking = await request('/api/bookings', { method: 'POST', body: JSON.stringify(payload) });
        showSuccess(booking, payload, depositApplies);
      } catch (cause) {
        error.textContent = cause.message || 'We could not save the booking. Please try again or call us.';
        error.hidden = false;
        submit.disabled = false;
        submit.textContent = 'Request this table';
        // The selected slot can be taken between the availability check and submission.
        // Refresh after a conflict; leave details intact for the customer to retry.
        if (/unavailable|capacity|time|table/i.test(cause.message || '')) loadAvailability();
      }
    });
    loadAvailability();
  }

  function showSuccess(booking, payload, depositApplies) {
    root.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'booking-success';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = booking.status === 'confirmed' ? 'BOOKING CONFIRMED' : 'REQUEST RECEIVED';
    const heading = document.createElement('h4');
    heading.textContent = booking.status === 'confirmed' ? 'See you soon!' : 'We have your request.';
    const copy = document.createElement('p');
    copy.textContent = depositApplies
      ? 'Please use your private booking link to complete any deposit payment and check the latest status.'
      : booking.status === 'confirmed'
        ? 'Your table is reserved. Keep your reference handy.'
        : 'Your table is awaiting confirmation. Keep your reference handy.';
    const list = document.createElement('dl');
    [['When', `${displayDate(payload.date)} at ${displayTime(payload.time)}`], ['Guests', String(payload.party_size)], ['Reference', String(booking.reference || 'Pending')]].forEach(([term, value]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = term;
      dd.textContent = value;
      row.append(dt, dd);
      list.append(row);
    });
    box.append(eyebrow, heading, copy, list);
    try {
      if (booking.manage_url) {
        const url = new URL(booking.manage_url);
        if (url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')) {
          const link = document.createElement('a');
          link.href = url.href;
          link.textContent = depositApplies ? 'Open your booking and pay deposit' : 'View or manage your booking';
          link.rel = 'noopener noreferrer';
          box.append(link);
        }
      }
    } catch (_) { /* A malformed optional URL should not hide the confirmed reservation. */ }
    root.append(box);
  }

  async function initBooking() {
    if (!apiBase) {
      showFallback('Online table bookings are being connected. Please call us to reserve your spot in the meantime.');
      return;
    }
    try {
      const config = await request('/api/bookings/config');
      const venueName = String(config.venue?.name || '').toLowerCase().replace('&', 'and');
      if (!/wild.*sun/.test(venueName)) {
        showFallback('Online bookings are not ready for this venue yet. Please call us to reserve a table.');
      } else if (config.provider !== 'native' || config.enabled !== true) {
        showFallback('Online table bookings are currently unavailable. Please call us to reserve a table.');
      } else {
        showOnlineBookingMessage();
        showBooking(config);
      }
    } catch (_) {
      showFallback('We cannot check live table availability right now. Please call us to reserve a table.');
    }
  }
  initBooking();
})();
