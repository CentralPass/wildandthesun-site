// Venue details and opening hours, owned by the CentralPass admin portal.
//
// The build bakes the admin values into each page (see build.mjs) so the HTML
// is correct without JavaScript. This script then re-reads the live values, so
// an edit in Admin > Settings > Venue or Admin > Hours shows up without a
// rebuild. It reads only public, unauthenticated endpoints.
(() => {
  'use strict';

  const TIMEZONE = 'Australia/Adelaide';
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const listeners = [];
  let venue = readBakedVenue();
  let today = null;
  let todayFetchedOn = -1;

  function readBakedVenue() {
    try {
      const data = JSON.parse(document.getElementById('venue-data').textContent);
      return { ...data, hours: normaliseHours(data.hours) };
    } catch (_) {
      return null;
    }
  }

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

  function clockTime(value) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(String(value || ''));
    return match ? match[1] + ':' + match[2] : null;
  }

  function normaliseHours(rows) {
    if (!Array.isArray(rows)) return null;
    const byDay = new Map();
    rows.forEach((row) => {
      const day = Number(row.day_of_week);
      if (!Number.isInteger(day) || day < 0 || day > 6) return;
      const open = clockTime(row.open_time);
      const close = clockTime(row.close_time);
      byDay.set(day, row.is_open && open && close ? { day_of_week: day, is_open: true, open_time: open, close_time: close } : { day_of_week: day, is_open: false, open_time: null, close_time: null });
    });
    return byDay.size === 7 ? [0, 1, 2, 3, 4, 5, 6].map((day) => byDay.get(day)) : null;
  }

  function displayTime(value) {
    const [hours, minutes] = value.split(':').map(Number);
    return String(hours % 12 || 12) + (minutes ? ':' + String(minutes).padStart(2, '0') : '') + (hours >= 12 ? 'pm' : 'am');
  }

  const minutesOf = (value) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
  const telHref = (phone) => 'tel:' + String(phone).replace(/[^0-9+]/g, '');
  const directionsUrl = (v) => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(v.name + ', ' + v.address);

  // Current day and minute at the café, whatever the visitor's own timezone.
  function venueNow() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
  }

  function openStatus() {
    if (!venue?.hours) return null;
    const now = venueNow();
    // Special days and the staff open/closed override arrive in `today`. It is
    // only valid for the day it was fetched, in case the page stays open overnight.
    const live = today && todayFetchedOn === now.day ? today : null;
    const todayRow = live
      ? { is_open: !!live.is_open, open_time: clockTime(live.open_time), close_time: clockTime(live.close_time) }
      : venue.hours[now.day];
    const special = live?.is_special_day && live.label ? String(live.label) + ': ' : '';
    if (live?.override_mode === 'open') {
      return { state: 'open', text: 'Open now' + (todayRow.close_time ? ' · until ' + displayTime(todayRow.close_time) : '') };
    }
    if (todayRow.is_open && todayRow.open_time && todayRow.close_time) {
      const openAt = minutesOf(todayRow.open_time);
      const closeAt = minutesOf(todayRow.close_time);
      if (now.minutes >= openAt && now.minutes < closeAt) return { state: 'open', text: special + 'Open now · until ' + displayTime(todayRow.close_time) };
      if (now.minutes < openAt) return { state: 'soon', text: special + 'Opens today at ' + displayTime(todayRow.open_time) };
    }
    for (let offset = 1; offset <= 7; offset += 1) {
      const day = (now.day + offset) % 7;
      const row = venue.hours[day];
      if (row.is_open) {
        const when = offset === 1 ? 'tomorrow' : DAY_NAMES[day].slice(0, 3);
        return { state: 'closed', text: special + (todayRow.is_open ? 'Closed now' : 'Closed today') + ' · opens ' + when + ' ' + displayTime(row.open_time) };
      }
    }
    return { state: 'closed', text: 'Closed now' };
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((element) => { element.textContent = value; });
  }

  function render() {
    if (!venue) return;
    setText('[data-venue="name"]', venue.name);
    setText('[data-venue="phone"]', venue.phone);
    setText('[data-venue="address"]', venue.address.replace(/\s*\n\s*/g, ', '));
    setText('[data-venue="email"]', venue.email || '');
    setText('[data-venue="abn"]', venue.abn || '');
    document.querySelectorAll('[data-venue="address-lines"]').forEach((element) => {
      element.replaceChildren();
      venue.address.split(/\s*[\n,]\s*/).filter(Boolean).forEach((line, index) => {
        if (index) element.append(document.createElement('br'));
        element.append(document.createTextNode(line));
      });
    });
    document.querySelectorAll('[data-venue-tel]').forEach((link) => { link.href = telHref(venue.phone); });
    document.querySelectorAll('[data-venue-directions]').forEach((link) => { link.href = directionsUrl(venue); });
    document.querySelectorAll('[data-venue-mailto]').forEach((link) => { if (venue.email) link.href = 'mailto:' + venue.email; });
    document.querySelectorAll('[data-venue-email-item]').forEach((element) => { element.hidden = !venue.email; });
    document.querySelectorAll('[data-venue-abn]').forEach((element) => { element.hidden = !venue.abn; });
    if (venue.hours) {
      const now = venueNow();
      document.querySelectorAll('[data-hours-list]').forEach((list) => {
        list.replaceChildren();
        [1, 2, 3, 4, 5, 6, 0].forEach((day) => {
          const row = venue.hours[day];
          const item = document.createElement('li');
          const name = document.createElement('span');
          const time = document.createElement('strong');
          item.dataset.day = String(day);
          name.textContent = DAY_NAMES[day];
          time.textContent = row.is_open ? displayTime(row.open_time) + ' – ' + displayTime(row.close_time) : 'Closed';
          if (day === now.day) {
            item.classList.add('is-today');
            const tag = document.createElement('em');
            tag.textContent = 'Today';
            name.append(' ', tag);
          }
          item.append(name, time);
          list.append(item);
        });
      });
    }
    const status = openStatus();
    if (status) {
      document.querySelectorAll('[data-open-status]').forEach((element) => {
        element.textContent = status.text;
        element.dataset.state = status.state;
      });
    }
  }

  async function getJson(base, path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(base + path, { headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error(path + ' returned ' + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function refresh() {
    const base = apiBase();
    if (!base || !venue) return;
    let settings;
    try { settings = await getJson(base, '/api/settings/public'); } catch (_) { return; }
    // Refuse another venue's details if the site is ever misconfigured.
    if (!/wild.*sun/i.test(String(settings.restaurant_name || ''))) return;
    const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
    venue = {
      ...venue,
      name: text(settings.restaurant_name) || venue.name,
      phone: text(settings.phone) || venue.phone,
      address: text(settings.address) || venue.address,
      email: text(settings.email),
      abn: text(settings.abn),
    };
    if (settings.features?.hours !== false) {
      try {
        const payload = await getJson(base, '/api/settings/hours');
        venue.hours = normaliseHours(payload.store_hours) || venue.hours;
        today = payload.today && typeof payload.today === 'object' ? payload.today : null;
        todayFetchedOn = venueNow().day;
      } catch (_) { /* The baked hours stay visible. */ }
    }
    render();
    listeners.forEach((listener) => { try { listener(venue); } catch (_) { /* One listener must not break others. */ } });
    document.dispatchEvent(new CustomEvent('wildsun:venue', { detail: venue }));
  }

  window.WildSun = Object.freeze({
    get venue() { return venue ? { ...venue, tel: telHref(venue.phone) } : null; },
    openStatus,
    displayTime,
    onVenueChange(listener) { listeners.push(listener); },
  });

  render();
  refresh();
  // Keep "Open now" honest for anyone who leaves the page open.
  setInterval(render, 60000);
})();
