// Table bookings through the venue's CentralPass backend.
//
// Flow: GET /api/bookings/config -> GET /api/bookings/availability for the real
// party size -> POST /api/bookings (idempotent with request_id). When the venue's
// deposit rules apply, the new booking is held as pending and the guest goes
// straight to Stripe Checkout via POST /api/booking-portal/checkout, using the
// private manage token returned only to them. Payment is confirmed by Stripe
// webhooks on the backend, never by this page. Without CENTRALPASS_API_BASE, or
// if anything is unavailable, the page offers message/email contact instead.
(() => {
  'use strict';

  const root = document.getElementById('booking-root');
  if (!root) return;

  const PENDING_KEY = 'wildsun:held-booking';
  const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
  const TOKEN_PATTERN = /^[0-9a-f]{48}$/i;
  const intro = document.querySelector('[data-booking-intro]');
  const depositNote = document.querySelector('[data-deposit-note]');
  const depositNoteText = document.querySelector('[data-deposit-note-text]');
  const base = apiBase();
  // Preview builds only: sample availability, nothing saved (see booking-demo.js).
  const demo = base ? null : window.WildSunBookingDemo || null;

  const state = {
    config: null,
    timezone: 'Australia/Adelaide',
    party: 2,
    date: '',
    time: '',
    retry: null,
    submitting: false,
    form: null,
  };

  function apiBase() {
    const raw = String(window.WILD_SUN_CONFIG?.centralpassApiBase || '').trim().replace(/\/+$/, '');
    if (!raw) return '';
    try {
      const url = new URL(raw);
      const local = ['localhost', '127.0.0.1'].includes(url.hostname);
      return url.protocol === 'https:' || (local && url.protocol === 'http:') ? url.origin : '';
    } catch (_) {
      return '';
    }
  }

  // ---------- small helpers ----------

  function h(tag, attributes = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (value === false || value == null) continue;
      if (key === 'text') element.textContent = value;
      else if (key.startsWith('on')) element.addEventListener(key.slice(2), value);
      else if (value === true) element.setAttribute(key, '');
      else element.setAttribute(key, value);
    }
    children.flat().forEach((child) => { if (child != null && child !== false) element.append(child); });
    return element;
  }

  const venue = () => window.WildSun?.venue || null;
  const instagramUrl = 'https://www.instagram.com/wild_and_the_sun_acai_cafe/';
  const contactLabel = () => venue()?.email ? 'Email us' : 'Message us on Instagram';
  const contactHref = () => venue()?.email
    ? 'mailto:' + venue().email + '?subject=' + encodeURIComponent('Wild and The Sun booking enquiry')
    : instagramUrl;

  function contactLink(className = '') {
    return h('a', {
      class: className,
      'data-booking-contact': true,
      href: contactHref(),
      ...(venue()?.email ? {} : { target: '_blank', rel: 'noopener noreferrer' }),
    }, contactLabel());
  }

  function syncContacts() {
    root.querySelectorAll('[data-booking-contact]').forEach((link) => {
      link.href = contactHref();
      link.textContent = contactLabel();
      if (venue()?.email) { link.removeAttribute('target'); link.removeAttribute('rel'); }
      else { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    });
  }
  window.WildSun?.onVenueChange(() => { syncContacts(); if (state.form) renderDates(); });

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return url.href;
    } catch (_) { /* Not a usable link. */ }
    return '';
  }

  const motionBehaviour = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  // Vertical page scroll only, clear of the fixed header.
  function scrollToElement(element) {
    const header = document.querySelector('[data-header]')?.offsetHeight || 0;
    const top = element.getBoundingClientRect().top + window.scrollY - header - 16;
    if (Math.abs(top - window.scrollY) > 40) window.scrollTo({ top, behavior: motionBehaviour() });
  }

  const money = (cents) => '$' + (cents / 100).toFixed(cents % 100 ? 2 : 0);
  const plural = (count, word) => count + ' ' + word + (count === 1 ? '' : 's');

  function venueToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: state.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  function dateParts(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  const addDays = (value, days) => { const date = dateParts(value); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
  const formatDate = (value, options) => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', ...options }).format(dateParts(value));
  const formatInstant = (value, options) => new Intl.DateTimeFormat('en-AU', { timeZone: state.timezone, ...options }).format(new Date(value));

  function displayTime(value) {
    const [hours, minutes] = value.split(':').map(Number);
    return String(hours % 12 || 12) + (minutes ? ':' + String(minutes).padStart(2, '0') : '') + (hours >= 12 ? 'pm' : 'am');
  }

  function readPending() {
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
      if (pending && TOKEN_PATTERN.test(pending.token) && Date.now() - pending.created < 6 * 3600000) return pending;
    } catch (_) { /* Storage can be unavailable in private modes. */ }
    clearPending();
    return null;
  }

  function savePending(pending) {
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch (_) { /* The on-screen link is the fallback. */ }
  }

  function clearPending() {
    try { sessionStorage.removeItem(PENDING_KEY); } catch (_) { /* Nothing to clear. */ }
  }

  async function api(path, { method = 'GET', body, token, signal, timeout = 15000 } = {}) {
    if (demo) return demo.request(path, { method, body, token });
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort);
    const timer = setTimeout(abort, timeout);
    const headers = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Booking ' + token;
    let response;
    try {
      response = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal });
    } catch (cause) {
      if (signal?.aborted) throw cause;
      throw Object.assign(new Error('We could not reach the booking system. Check your connection and try again.'), { network: true });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fallback = response.status === 429 ? 'Lots of people are booking right now. Please wait a moment and try again.'
        : response.status >= 500 ? 'The booking system had a problem. Please try again, or message us.'
          : 'That did not work. Please try again.';
      throw Object.assign(new Error(payload.error || fallback), { status: response.status, code: payload.code });
    }
    return payload;
  }

  // ---------- deposits ----------

  function depositRules() {
    const rules = state.config?.deposits || {};
    return rules.deposit_enabled ? rules : null;
  }

  function depositFor(party) {
    const rules = depositRules();
    if (!rules || party < Number(rules.deposit_min_party)) return null;
    const cents = Number(rules.deposit_amount_cents) * (rules.deposit_basis === 'per_person' ? party : 1);
    return Number.isSafeInteger(cents) && cents > 0 ? { cents, version: Number(rules.deposit_version) } : null;
  }

  function depositPolicyText(cents) {
    const rules = depositRules();
    const refundHours = Number(rules.deposit_refund_hours);
    const hold = Number(rules.deposit_hold_minutes);
    const refund = refundHours > 0
      ? 'Cancel at least ' + plural(refundHours, 'hour') + ' before your booking for a full refund; later cancellations keep the deposit.'
      : 'Cancel before your booking for a full refund.';
    return 'A ' + money(cents) + ' AUD deposit holds this table and comes off your bill on the day. ' + refund + ' If the café cancels, you get a full refund. Pay within ' + plural(hold, 'minute') + ' of booking, otherwise the table is released.';
  }

  function describeDepositRule() {
    const rules = depositRules();
    if (!rules) return '';
    const amount = money(Number(rules.deposit_amount_cents)) + (rules.deposit_basis === 'per_person' ? ' per guest' : '');
    const who = Number(rules.deposit_min_party) > 1 ? 'Bookings for ' + rules.deposit_min_party + ' or more guests' : 'Bookings';
    return who + ' need a ' + amount + ' deposit, paid securely with Stripe and taken off your bill.';
  }

  // ---------- states ----------

  function showFallback(message) {
    state.form = null;
    root.classList.remove('is-live');
    const contact = contactLink('btn btn-primary');
    root.replaceChildren(h('div', { class: 'booking-fallback' },
      h('h2', { text: 'Send us your booking details.' }),
      h('p', { text: message }),
      contact,
      h('a', { class: 'text-link', href: '/visit/#find', text: 'Or come in and see us' }),
    ));
  }

  function showSkeleton() {
    root.replaceChildren(h('div', { class: 'booking-skeleton', 'aria-hidden': 'true' },
      h('span', { class: 'sk sk-title' }), h('span', { class: 'sk sk-line' }),
      h('span', { class: 'sk sk-row' }), h('span', { class: 'sk sk-row' }), h('span', { class: 'sk sk-grid' })),
    h('p', { class: 'sr-only', role: 'status', text: 'Loading table availability…' }));
  }

  function showOnlineIntro() {
    if (intro) intro.textContent = 'Choose a day, a time and how many are coming. We’ll save you a seat.';
    const text = describeDepositRule();
    if (depositNote && text) {
      depositNoteText.textContent = text;
      depositNote.hidden = false;
    }
  }

  // ---------- the form ----------

  function renderForm() {
    const config = state.config;
    const maxParty = Math.min(Math.max(Number(config.max_party_size) || 12, 1), 100);
    state.maxParty = maxParty;
    state.maxDays = Math.min(Math.max(Number(config.max_days_ahead) || 60, 0), 365);
    state.party = Math.min(state.party, maxParty);
    state.submitting = false;
    state.retry = null;
    state.time = '';

    const partyOutput = h('output', { class: 'stepper-value', 'aria-live': 'polite' });
    const fewer = h('button', { type: 'button', class: 'stepper-btn', 'aria-label': 'Fewer guests', text: '−' });
    const more = h('button', { type: 'button', class: 'stepper-btn', 'aria-label': 'More guests', text: '+' });
    const partyHint = h('p', { class: 'field-hint' });
    const dateStrip = h('div', { class: 'date-strip', role: 'group', 'aria-label': 'Choose a day' });
    const dateInput = h('input', { type: 'date', class: 'date-picker-input', min: venueToday(), max: addDays(venueToday(), state.maxDays) });
    const dateLabel = h('span', { class: 'date-picker-text', text: 'More dates' });
    const datePicker = h('label', { class: 'date-picker' }, calendarIcon(), dateLabel, h('span', { class: 'sr-only', text: ', opens a calendar' }), dateInput);
    const times = h('div', { class: 'time-slots' });
    const timeStatus = h('p', { class: 'field-hint', role: 'status' });
    const nameInput = h('input', { name: 'name', type: 'text', autocomplete: 'name', maxlength: '120', required: true });
    const phoneInput = h('input', { name: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', minlength: '6', maxlength: '30', required: true });
    const emailInput = h('input', { name: 'email', type: 'email', autocomplete: 'email', maxlength: '255' });
    const emailLabel = h('span', {}, 'Email ', h('small', { text: '(optional)' }));
    const notesInput = h('textarea', { name: 'notes', rows: '2', maxlength: '500', placeholder: 'A celebration, a high chair, accessibility needs…' });
    const depositAmount = h('strong', { class: 'deposit-amount' });
    const depositPolicy = h('p', { class: 'deposit-policy' });
    const depositAccept = h('input', { type: 'checkbox', name: 'accept_deposit' });
    const deposit = h('div', { class: 'deposit', hidden: true },
      h('div', { class: 'deposit-head' }, depositAmount, h('span', { text: 'deposit to hold this table' })),
      depositPolicy,
      h('label', { class: 'check' }, depositAccept, h('span', { text: 'I accept the deposit and cancellation policy.' })),
      h('p', { class: 'stripe-note' }, h('span', { class: 'lock', 'aria-hidden': 'true' }), 'Payment is processed securely by Stripe. Card details never touch this website.'),
    );
    const summary = h('p', { class: 'booking-summary' });
    const error = h('p', { class: 'booking-error', role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' });
    const details = h('div', { class: 'booking-details', hidden: true },
      h('fieldset', { class: 'field-group' },
        h('legend', {}, h('span', { class: 'step', text: '4' }), 'Your details'),
        h('div', { class: 'field-row' },
          h('label', { class: 'field' }, h('span', { text: 'Name' }), nameInput),
          h('label', { class: 'field' }, h('span', { text: 'Mobile' }), phoneInput)),
        h('label', { class: 'field' }, emailLabel, emailInput),
        h('label', { class: 'field' }, h('span', {}, 'Anything we should know? ', h('small', { text: '(optional)' })), notesInput)),
      deposit, summary, error, submit,
      h('p', { class: 'fine-print' }, 'Your details are used only to manage this booking. You are not signed up for marketing. ', h('a', { href: '/privacy/', text: 'Privacy' })),
    );
    const form = h('form', { class: 'booking-form', 'aria-labelledby': 'booking-heading' },
      h('div', { class: 'booking-head' },
        h('h2', { id: 'booking-heading', tabindex: '-1', text: 'Find your table' })),
      h('fieldset', { class: 'field-group' },
        h('legend', {}, h('span', { class: 'step', text: '1' }), 'Guests'),
        h('div', { class: 'stepper' }, fewer, partyOutput, more), partyHint),
      h('fieldset', { class: 'field-group' },
        h('legend', {}, h('span', { class: 'step', text: '2' }), 'Day'),
        dateStrip, datePicker),
      h('fieldset', { class: 'field-group' },
        h('legend', {}, h('span', { class: 'step', text: '3' }), 'Time'),
        timeStatus, times),
      details,
    );

    state.form = { form, partyOutput, fewer, more, partyHint, dateStrip, dateInput, dateLabel, datePicker, times, timeStatus, details, nameInput, phoneInput, emailInput, emailLabel, notesInput, deposit, depositAmount, depositPolicy, depositAccept, summary, error, submit };
    root.replaceChildren(form);
    if (config.demo) form.prepend(h('p', { class: 'demo-note', text: 'Preview only: sample times, and a sample deposit for groups of 8 or more. No booking is made.' }));

    fewer.addEventListener('click', () => setParty(state.party - 1));
    more.addEventListener('click', () => setParty(state.party + 1));
    dateInput.addEventListener('change', () => { if (dateInput.value) setDate(dateInput.value); });
    // Desktop browsers only open the calendar from its own icon; open it from
    // anywhere on the button. Phones open it natively on tap.
    const openPicker = () => { try { dateInput.showPicker?.(); } catch (_) { /* Not allowed here; the native control still works. */ } };
    dateInput.addEventListener('click', openPicker);
    dateInput.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); } });
    depositAccept.addEventListener('change', () => { error.hidden = true; });
    form.addEventListener('submit', submitBooking);

    renderParty();
    state.date = firstOpenDate();
    renderDates();
    loadTimes();
  }

  // After replacing a booking state, keep keyboard focus in the card.
  function focusForm() {
    root.querySelector('#booking-heading')?.focus({ preventScroll: true });
  }

  function isWeeklyClosed(value) {
    const hours = venue()?.hours;
    return !!hours && !hours[dateParts(value).getUTCDay()]?.is_open;
  }

  // Minutes past midnight at the café, whatever the guest's own timezone.
  function venueMinutesNow() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: state.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    return Number(parts.find((part) => part.type === 'hour').value) * 60 + Number(parts.find((part) => part.type === 'minute').value);
  }

  function closedForToday(value) {
    const row = venue()?.hours?.[dateParts(value).getUTCDay()];
    if (!row?.is_open || !row.close_time) return false;
    const [hours, minutes] = row.close_time.split(':').map(Number);
    return venueMinutesNow() >= hours * 60 + minutes;
  }

  function firstOpenDate() {
    const today = venueToday();
    for (let offset = 0; offset <= Math.min(state.maxDays, 14); offset += 1) {
      const candidate = addDays(today, offset);
      if (isWeeklyClosed(candidate) || (offset === 0 && closedForToday(candidate))) continue;
      return candidate;
    }
    return today;
  }

  function renderParty() {
    const f = state.form;
    f.partyOutput.textContent = plural(state.party, 'guest');
    f.fewer.disabled = state.party <= 1;
    f.more.disabled = state.party >= state.maxParty;
    f.partyHint.replaceChildren();
    if (state.party >= state.maxParty) {
      f.partyHint.append('More than ' + state.maxParty + '? ', contactLink(), ' about a group or occasion.');
    }
    updateDeposit();
  }

  function setParty(value) {
    const next = Math.min(Math.max(value, 1), state.maxParty);
    if (next === state.party) return;
    state.party = next;
    renderParty();
    loadTimes(true);
  }

  function renderDates() {
    const f = state.form;
    if (!f) return;
    const today = venueToday();
    const count = Math.min(state.maxDays, 13);
    f.dateStrip.replaceChildren();
    for (let offset = 0; offset <= count; offset += 1) {
      const value = addDays(today, offset);
      const closed = isWeeklyClosed(value);
      const top = offset === 0 ? 'Today' : offset === 1 ? 'Tmrw' : formatDate(value, { weekday: 'short' });
      const chip = h('button', {
        type: 'button', class: 'date-chip', 'aria-pressed': String(value === state.date), disabled: closed,
        'aria-label': formatDate(value, { weekday: 'long', day: 'numeric', month: 'long' }) + (closed ? ', closed' : ''),
      }, h('span', { class: 'date-chip-day', text: top }), h('strong', { text: formatDate(value, { day: 'numeric' }) }), h('span', { class: 'date-chip-month', text: closed ? 'Closed' : formatDate(value, { month: 'short' }) }));
      chip.addEventListener('click', () => setDate(value));
      f.dateStrip.append(chip);
    }
    const inStrip = [...Array(count + 1).keys()].some((offset) => addDays(today, offset) === state.date);
    f.dateInput.value = inStrip ? '' : state.date;
    f.dateLabel.textContent = inStrip ? 'More dates' : formatDate(state.date, { weekday: 'short', day: 'numeric', month: 'short' });
    f.datePicker.classList.toggle('is-active', !inStrip);
  }

  function setDate(value) {
    if (value === state.date) return;
    state.date = value;
    renderDates();
    // Scroll only the strip; scrollIntoView would also nudge clipped ancestors.
    const strip = state.form.dateStrip;
    const chip = strip.querySelector('[aria-pressed="true"]');
    if (chip) strip.scrollTo({ left: chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2, behavior: motionBehaviour() });
    loadTimes();
  }

  let availabilityController = null;
  let availabilityTimer = null;
  // The platform allows 20 public booking requests a minute per visitor, so
  // flicking back to a day already checked reuses the answer for a short
  // while. Creating the booking re-checks capacity on the server regardless.
  const availabilityCache = new Map();
  const CACHE_MS = 45000;

  function loadTimes(debounce = false) {
    clearTimeout(availabilityTimer);
    availabilityController?.abort();
    const f = state.form;
    selectTime('');
    f.times.replaceChildren(...Array.from({ length: 6 }, () => h('span', { class: 'sk sk-chip', 'aria-hidden': 'true' })));
    f.timeStatus.textContent = 'Checking tables for ' + plural(state.party, 'guest') + '…';
    const key = state.date + '|' + state.party;
    const cached = availabilityCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      renderTimes(cached.result);
      return;
    }
    const run = async () => {
      const controller = new AbortController();
      availabilityController = controller;
      try {
        const query = new URLSearchParams({ date: state.date, party_size: String(state.party) });
        const result = await api('/api/bookings/availability?' + query, { signal: controller.signal, timeout: 12000 });
        if (controller.signal.aborted) return;
        availabilityCache.set(key, { at: Date.now(), result });
        renderTimes(result);
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause.status === 402) { showFallback('Online bookings are not available right now. Please message or email us to book.'); return; }
        f.times.replaceChildren();
        f.timeStatus.textContent = cause.status === 400 ? cause.message
          : cause.status === 429 ? 'Lots of people are checking tables right now. '
            : 'We couldn’t check tables just now. ';
        if (cause.status !== 400) f.timeStatus.append(h('button', { type: 'button', class: 'link-button', text: 'Try again', onclick: () => loadTimes() }));
      }
    };
    if (debounce) availabilityTimer = setTimeout(run, 250);
    else run();
  }

  function renderTimes(result) {
    const f = state.form;
    const slots = (Array.isArray(result.slots) ? result.slots : [])
      .filter((slot) => slot.available && TIME_PATTERN.test(slot.time) && (slot.seats_left == null || Number(slot.seats_left) >= state.party));
    f.times.replaceChildren();
    if (!slots.length) {
      f.timeStatus.textContent = emptyReason(result) + ' ';
      const next = nextOpenDate(state.date);
      if (next) f.timeStatus.append(h('button', { type: 'button', class: 'link-button', text: 'Try ' + formatDate(next, { weekday: 'long' }), onclick: () => setDate(next) }));
      return;
    }
    const groups = [['Morning', (m) => m < 720], ['Afternoon', (m) => m >= 720 && m < 1020], ['Evening', (m) => m >= 1020]]
      .map(([label, test]) => [label, slots.filter((slot) => { const [hh, mm] = slot.time.split(':').map(Number); return test(hh * 60 + mm); })])
      .filter(([, list]) => list.length);
    groups.forEach(([label, list]) => {
      const row = h('div', { class: 'time-row', role: 'group', 'aria-label': label + ' times' });
      list.forEach((slot) => {
        const chip = h('button', { type: 'button', class: 'time-chip', 'aria-pressed': 'false', 'data-time': slot.time, text: displayTime(slot.time) });
        chip.addEventListener('click', () => selectTime(slot.time));
        row.append(chip);
      });
      f.times.append(groups.length > 1 ? h('div', { class: 'time-group' }, h('span', { class: 'time-group-label', text: label }), row) : row);
    });
    f.timeStatus.textContent = plural(slots.length, 'time') + ' available on ' + formatDate(state.date, { weekday: 'long', day: 'numeric', month: 'long' }) + '.';
  }

  function emptyReason(result) {
    if (result.open === false) return !result.reason || result.reason === 'Closed' ? 'We’re closed on this day.' : result.reason;
    const reasons = new Set((result.slots || []).map((slot) => slot.reason));
    if (reasons.size === 1 && reasons.has('too soon')) return 'Online bookings for this day have closed.';
    if ([...reasons].every((reason) => reason === 'fully booked' || /capacity/i.test(reason || ''))) return 'We’re fully booked for ' + plural(state.party, 'guest') + ' on this day.';
    return 'No tables are free for ' + plural(state.party, 'guest') + ' on this day.';
  }

  function nextOpenDate(from) {
    const last = addDays(venueToday(), state.maxDays);
    for (let offset = 1; offset <= 7; offset += 1) {
      const candidate = addDays(from, offset);
      if (candidate > last) return '';
      if (!isWeeklyClosed(candidate)) return candidate;
    }
    return '';
  }

  function selectTime(time) {
    const f = state.form;
    state.time = time;
    f.times.querySelectorAll('.time-chip').forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.time === time)));
    const wasHidden = f.details.hidden;
    f.details.hidden = !time;
    f.error.hidden = true;
    updateDeposit();
    if (time && wasHidden && matchMedia('(max-width: 900px)').matches) scrollToElement(f.details);
  }

  function updateDeposit() {
    const f = state.form;
    if (!f) return;
    const deposit = depositFor(state.party);
    f.deposit.hidden = !deposit;
    f.emailInput.required = !!deposit;
    f.emailLabel.replaceChildren('Email ', h('small', { text: deposit ? '(for your receipt)' : '(optional)' }));
    if (deposit) {
      f.depositAmount.textContent = money(deposit.cents);
      f.depositPolicy.textContent = depositPolicyText(deposit.cents);
    } else {
      f.depositAccept.checked = false;
    }
    const when = state.time ? formatDate(state.date, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + displayTime(state.time) + ' · ' + plural(state.party, 'guest') : '';
    f.summary.textContent = when + (deposit && when ? ' · ' + money(deposit.cents) + ' deposit' : '');
    f.submit.textContent = deposit ? 'Hold table & pay ' + money(deposit.cents) + ' deposit' : state.config.auto_confirm ? 'Confirm booking' : 'Request this table';
  }

  function showError(message, withContact = false) {
    const f = state.form;
    f.error.replaceChildren(message);
    if (withContact) f.error.append(' ', contactLink(), '.');
    f.error.hidden = false;
  }

  function setSubmitting(active, label) {
    const f = state.form;
    state.submitting = active;
    f.form.classList.toggle('is-busy', active);
    f.submit.disabled = active;
    if (active) f.submit.textContent = label;
    else updateDeposit();
  }

  async function submitBooking(event) {
    event.preventDefault();
    const f = state.form;
    if (state.submitting) return;
    if (!state.time) { showError('Choose a time first.'); return; }
    if (!f.form.reportValidity()) return;
    const deposit = depositFor(state.party);
    if (deposit && !f.depositAccept.checked) {
      showError('Please read and accept the deposit policy to continue.');
      f.depositAccept.focus();
      return;
    }
    const payload = {
      date: state.date,
      time: state.time,
      party_size: state.party,
      name: f.nameInput.value.trim(),
      phone: f.phoneInput.value.trim(),
      ...(f.emailInput.value.trim() ? { email: f.emailInput.value.trim() } : {}),
      ...(f.notesInput.value.trim() ? { notes: f.notesInput.value.trim() } : {}),
      ...(deposit ? { accept_deposit_policy: true, deposit_policy_version: deposit.version } : {}),
    };
    // One request_id per intended booking, kept across retries so a lost
    // response can never create a second reservation.
    const signature = JSON.stringify(payload);
    if (!state.retry || state.retry.signature !== signature) state.retry = { signature, id: uuid() };
    f.error.hidden = true;
    setSubmitting(true, deposit ? 'Holding your table…' : 'Booking your table…');
    let booking;
    try {
      booking = await api('/api/bookings', { method: 'POST', body: { ...payload, request_id: state.retry.id }, timeout: 20000 });
    } catch (cause) {
      setSubmitting(false);
      handleSubmitError(cause);
      return;
    }
    state.retry = null;
    availabilityCache.clear();
    const view = {
      reference: String(booking.reference || ''),
      status: booking.status,
      bookedFor: booking.booked_for,
      party: Number(booking.party_size) || state.party,
      name: payload.name,
      manageUrl: safeUrl(booking.manage_url),
    };
    if (deposit && booking.status === 'pending' && TOKEN_PATTERN.test(booking.manage_token || '')) {
      const pending = { ...view, token: booking.manage_token, cents: deposit.cents, version: deposit.version, created: Date.now() };
      savePending(pending);
      await startCheckout(pending);
    } else {
      showSuccess(view);
    }
  }

  async function handleSubmitError(cause) {
    switch (cause.code) {
      case 'DEPOSIT_POLICY_REQUIRED':
        try {
          state.config = await api('/api/bookings/config');
          showOnlineIntro();
        } catch (_) { /* Keep the current terms on screen. */ }
        state.form.depositAccept.checked = false;
        updateDeposit();
        showError('The deposit terms have just been updated. Please review and accept them again. Your details are kept.');
        return;
      case 'PARTY_TOO_LARGE':
        showError(cause.message, true);
        return;
      case 'PAYMENTS_UNAVAILABLE':
      case 'DEPOSIT_TIME':
        showError(cause.message, true);
        return;
      case 'NOT_NATIVE':
        showFallback('Online bookings are paused right now. Please message or email us to book.');
        return;
      default:
        if (cause.status === 402) { showFallback('Online bookings are not available right now. Please message or email us to book.'); return; }
        if (cause.status === 409) {
          availabilityCache.clear();
          showError(cause.message + ' Please choose another time. Your details are kept.');
          loadTimes();
          return;
        }
        showError(cause.message, !!cause.network || cause.status >= 500);
    }
  }

  // ---------- deposit checkout ----------

  async function startCheckout(pending) {
    showPaying(pending);
    try {
      const result = await api('/api/booking-portal/checkout', {
        method: 'POST', token: pending.token, timeout: 20000,
        body: { accept_policy: true, policy_version: pending.version },
      });
      if (result.paid) {
        clearPending();
        showSuccess({ ...pending, status: 'confirmed' }, { depositPaid: true });
        return;
      }
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('The payment provider returned an unexpected link.');
      location.assign(url.href);
    } catch (cause) {
      showDepositDue(pending, checkoutProblem(cause));
    }
  }

  // The backend's own checkout refusals are written for guests. Anything else
  // (payment-provider errors, outages) gets a plain message instead of raw text.
  function checkoutProblem(cause) {
    const own = [404, 409, 503].includes(cause.status) || (cause.status === 400 && /deposit policy/i.test(cause.message));
    if (own) return cause.message;
    if (cause.network) return cause.message;
    return 'We couldn’t open the secure payment page just now. Your table is still held, so please try again in a moment.';
  }

  function bookingFacts(view) {
    const rows = [];
    if (view.bookedFor) rows.push(['When', formatInstant(view.bookedFor, { weekday: 'long', day: 'numeric', month: 'long' }) + ' at ' + formatInstant(view.bookedFor, { hour: 'numeric', minute: '2-digit' }).replace(/\s+/g, '').toLowerCase()]);
    rows.push(['Guests', String(view.party)]);
    if (view.reference) rows.push(['Reference', view.reference]);
    return h('dl', { class: 'booking-facts' }, rows.map(([term, value]) => h('div', {}, h('dt', { text: term }), h('dd', { text: value }))));
  }

  function showPaying(pending) {
    state.form = null;
    root.replaceChildren(h('div', { class: 'booking-state' },
      h('span', { class: 'spinner', 'aria-hidden': 'true' }),
      h('h2', { tabindex: '-1', text: 'Taking you to secure payment…' }),
      state.config?.demo ? h('p', { class: 'demo-note', text: 'Preview only: Stripe is skipped here. The live site opens Stripe’s secure checkout at this step.' }) : null,
      h('p', { role: 'status', text: 'Your ' + money(pending.cents) + ' deposit is paid through Stripe. You will come back to your booking page once it is done.' }),
      bookingFacts(pending)));
    root.querySelector('h2').focus({ preventScroll: true });
  }

  function showDepositDue(pending, problem) {
    state.form = null;
    const pay = h('button', { type: 'button', class: 'btn btn-primary', text: 'Pay ' + money(pending.cents) + ' deposit securely' });
    pay.addEventListener('click', () => startCheckout(pending));
    const actions = h('div', { class: 'actions' }, pay);
    if (pending.manageUrl) actions.append(h('a', { class: 'text-link', href: pending.manageUrl, rel: 'noopener noreferrer', text: 'Open your booking page' }));
    const restart = h('button', { type: 'button', class: 'link-button', text: 'Start a different booking' });
    restart.addEventListener('click', () => {
      if (!window.confirm('Your held table stays reserved until its payment deadline, then it is released. Start a different booking?')) return;
      clearPending();
      renderForm();
      focusForm();
    });
    root.replaceChildren(h('div', { class: 'booking-state' },
      h('h2', { tabindex: '-1', text: 'Your table is waiting for you.' }),
      h('p', { text: 'Pay the ' + money(pending.cents) + ' deposit to confirm it. Unpaid tables are released when the payment window closes.' }),
      problem ? h('p', { class: 'booking-error', role: 'alert', text: problem }) : null,
      bookingFacts(pending), actions,
      h('p', { class: 'fine-print' }, 'Keep your booking page link. It is private to you. Questions? ', contactLink(), '.'),
      restart));
    root.querySelector('h2').focus({ preventScroll: true });
  }

  // Someone may come back here from Stripe with the back button, or reload.
  // Check the held booking's real state before offering anything.
  async function resumePending() {
    const pending = readPending();
    if (!pending) return false;
    try {
      const hub = await api('/api/booking-portal', { token: pending.token });
      const payment = hub.payment;
      const view = { ...pending, status: hub.booking?.status || pending.status, bookedFor: hub.booking?.booked_for || pending.bookedFor, party: hub.booking?.party_size || pending.party };
      if (payment?.status === 'due' && payment.can_pay && view.status === 'pending') {
        showDepositDue({ ...view, cents: Number(payment.amount_cents) || pending.cents, version: Number(payment.policy?.deposit_version) || pending.version });
        return true;
      }
      clearPending();
      if (payment?.status === 'paid' || ['confirmed', 'arrived', 'seated'].includes(view.status)) {
        showSuccess(view, { depositPaid: payment?.status === 'paid' });
        return true;
      }
      return false;
    } catch (_) {
      clearPending();
      return false;
    }
  }

  // ---------- success ----------

  function calendarFile(view) {
    const start = new Date(view.bookedFor);
    const minutes = Number(state.config?.default_duration_minutes) || 60;
    const end = new Date(start.getTime() + minutes * 60000);
    const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const escape = (text) => String(text || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&');
    const place = venue();
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wild and The Sun//Bookings//EN', 'BEGIN:VEVENT',
      'UID:' + (view.reference || uuid()) + '@wild-and-the-sun', 'DTSTAMP:' + stamp(new Date()), 'DTSTART:' + stamp(start), 'DTEND:' + stamp(end),
      'SUMMARY:' + escape((place?.name || 'Wild and The Sun') + ' · table for ' + view.party),
      'LOCATION:' + escape(place?.address || ''),
      'DESCRIPTION:' + escape('Booking ' + view.reference + '. Check your booking link for the latest status.'),
      'END:VEVENT', 'END:VCALENDAR'];
    return new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
  }

  function showSuccess(view, { depositPaid = false } = {}) {
    state.form = null;
    const confirmed = ['confirmed', 'arrived', 'seated'].includes(view.status);
    const firstName = String(view.name || '').trim().split(/\s+/)[0];
    const heading = confirmed ? 'See you soon' + (firstName ? ', ' + firstName : '') + '!' : 'We have your request.';
    const copy = depositPaid ? 'Deposit received. It comes off your bill on the day.'
      : confirmed ? 'Your table is booked. Keep your reference handy.'
        : 'The café will confirm your table shortly. Check your booking link for updates.';
    const actions = h('div', { class: 'actions' });
    if (view.bookedFor) {
      const add = h('button', { type: 'button', class: 'btn btn-outline', text: 'Add to calendar' });
      add.addEventListener('click', () => {
        const url = URL.createObjectURL(calendarFile(view));
        const link = h('a', { href: url, download: (view.reference || 'booking') + '.ics' });
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      actions.append(add);
    }
    if (view.manageUrl) actions.append(h('a', { class: 'btn btn-primary', href: view.manageUrl, rel: 'noopener noreferrer', text: 'View or change booking' }));
    const again = h('button', { type: 'button', class: 'link-button', text: 'Make another booking' });
    again.addEventListener('click', () => { renderForm(); focusForm(); });
    root.replaceChildren(h('div', { class: 'booking-state booking-success' },
      h('span', { class: 'success-mark', 'aria-hidden': 'true' }, successIcon()),
      h('h2', { tabindex: '-1', text: heading }),
      h('p', { text: copy }),
      state.config?.demo ? h('p', { class: 'demo-note', text: 'Preview only: no booking was made and nothing was charged.' }) : null,
      bookingFacts(view),
      actions,
      h('p', { class: 'fine-print' }, view.manageUrl ? 'Your booking link is private. Anyone with it can view or cancel this booking. Need help? ' : 'To change or cancel, ', contactLink(), '.'),
      again));
    root.querySelector('h2').focus({ preventScroll: true });
    scrollToElement(root);
  }

  function calendarIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2 8h2m3 0h2m-7 4h2m3 0h2');
    svg.append(path);
    return svg;
  }

  function successIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 52 52');
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '26'); circle.setAttribute('cy', '26'); circle.setAttribute('r', '24');
    const tick = document.createElementNS(ns, 'path');
    tick.setAttribute('d', 'M15 27l7 7 15-16');
    svg.append(circle, tick);
    return svg;
  }

  // ---------- start ----------

  async function init() {
    if (!base && !demo) return; // The message/email booking card in the page stays.
    root.classList.add('is-live');
    showSkeleton();
    let config;
    try {
      config = await api('/api/bookings/config');
    } catch (cause) {
      showFallback(cause.status === 402 ? 'Online bookings are not available right now. Please message or email us to book.' : 'We can’t load live availability right now. Please message or email us to book.');
      return;
    }
    // Never take bookings for another venue if the site is misconfigured.
    if (!/wild.*sun/.test(String(config.venue?.name || '').toLowerCase().replace(/&/g, 'and'))) {
      showFallback('Online bookings aren’t ready yet. Please message or email us to book.');
      return;
    }
    if (config.provider !== 'native' || config.enabled !== true) {
      showFallback('Online bookings are paused right now. Please message or email us to book.');
      return;
    }
    state.config = config;
    if (typeof config.timezone === 'string' && config.timezone) state.timezone = config.timezone;
    showOnlineIntro();
    if (await resumePending()) return;
    renderForm();
  }

  // Coming back from Stripe with the back button can restore this page from
  // the browser cache mid-redirect. Re-check the held booking.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && state.config && readPending()) resumePending().then((shown) => { if (!shown) renderForm(); });
  });

  init();
})();
