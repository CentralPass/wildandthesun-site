// Preview-only stand-in for the CentralPass booking API, so the booking form can
// be reviewed before Wild and The Sun's backend exists. Nothing is saved and no
// payment is taken. build.mjs only loads this file when BOOKING_DEMO=true and no
// CENTRALPASS_API_BASE is set; deploy-live.ps1 never sets it.
(() => {
  'use strict';

  const TIMEZONE = 'Australia/Adelaide';
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const venue = () => window.WildSun?.venue || null;
  const fail = (message, status, code) => Promise.reject(Object.assign(new Error(message), { status, code }));

  // A sample policy so the deposit step can be seen. Real rules come from the admin.
  const SAMPLE_DEPOSIT_PARTY = 8;

  function config() {
    return {
      provider: 'native',
      enabled: true,
      demo: true,
      max_party_size: 12,
      max_days_ahead: 60,
      auto_confirm: true,
      timezone: TIMEZONE,
      default_duration_minutes: 90,
      hub_configured: false,
      deposits: {
        deposit_enabled: true,
        deposit_min_party: SAMPLE_DEPOSIT_PARTY,
        deposit_basis: 'per_person',
        deposit_amount_cents: 1000,
        deposit_hold_minutes: 30,
        deposit_refund_hours: 24,
        deposit_version: 1,
      },
      venue: { name: venue()?.name || 'Wild and The Sun Açaí Cafe', address: venue()?.address || '', phone: venue()?.phone || '' },
    };
  }

  function venueClock(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type).value;
    return { date: get('year') + '-' + get('month') + '-' + get('day'), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
  }

  const toMinutes = (value) => { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + minutes; };
  const clock = (minutes) => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');

  // Stable pseudo-random "busy" slots, so the sample diary looks lived in.
  function busy(text) {
    let hash = 2166136261;
    for (const character of text) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0) % 5 === 0;
  }

  function availability(date) {
    const [year, month, day] = date.split('-').map(Number);
    const row = venue()?.hours?.[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
    if (!row?.is_open) return { date, open: false, reason: 'Closed', slots: [] };
    const now = venueClock();
    const slots = [];
    for (let minutes = toMinutes(row.open_time); minutes <= toMinutes(row.close_time) - 60; minutes += 15) {
      const time = clock(minutes);
      const past = date < now.date || (date === now.date && minutes < now.minutes + 30);
      const full = !past && busy(date + time);
      slots.push({ time, available: !past && !full, seats_left: past || full ? 0 : 12, reason: past ? 'too soon' : full ? 'fully booked' : null });
    }
    return { date, open: true, slots };
  }

  // Café-local date and time to an instant, allowing for daylight saving.
  function instant(date, time) {
    const [year, month, day] = date.split('-').map(Number);
    const target = toMinutes(time);
    let guess = Date.UTC(year, month - 1, day, 0, target) - 570 * 60000;
    for (let pass = 0; pass < 2; pass += 1) {
      const local = venueClock(new Date(guess));
      const dayShift = local.date === date ? 0 : local.date < date ? 1440 : -1440;
      guess += (target - local.minutes + dayShift) * 60000;
    }
    return new Date(guess).toISOString();
  }

  const reference = () => 'DEMO-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, '0')).join('');

  async function request(path, { method = 'GET', body } = {}) {
    await wait(280 + Math.random() * 320);
    const url = new URL(path, 'https://preview.invalid');
    if (url.pathname === '/api/bookings/config') return config();
    if (url.pathname === '/api/bookings/availability') return availability(url.searchParams.get('date'));
    if (url.pathname === '/api/bookings' && method === 'POST') {
      const slot = availability(body.date).slots.find((item) => item.time === body.time);
      if (!slot?.available) return fail('That time has just been taken.', 409, 'SLOT_UNAVAILABLE');
      const deposit = body.party_size >= SAMPLE_DEPOSIT_PARTY;
      return {
        reference: reference(),
        status: deposit ? 'pending' : 'confirmed',
        booked_for: instant(body.date, body.time),
        party_size: body.party_size,
        name: body.name,
        ...(deposit ? { manage_token: token() } : {}),
      };
    }
    // Stripe Checkout is skipped in the preview; the live site redirects here.
    if (url.pathname === '/api/booking-portal/checkout') {
      await wait(1600);
      return { paid: true };
    }
    return fail('Not available in the preview.', 404);
  }

  window.WildSunBookingDemo = Object.freeze({ request });
})();
