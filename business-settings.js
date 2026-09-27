(() => {
  'use strict';
  const rawBase = String(window.WILD_SUN_CONFIG?.centralpassApiBase || '').trim().replace(/\/+$/, '');
  let base = '';
  try { const url = new URL(rawBase); if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) base = url.href.replace(/\/+$/, ''); } catch (_) { return; }
  if (!base) return;
  const defaultPhone = '0451 661 351';
  function setPhone(phone) {
    const digits = String(phone).replace(/[^0-9+]/g, '');
    if (!/^\+?[0-9]{8,15}$/.test(digits)) return;
    const visible = String(phone).trim();
    document.querySelectorAll('[data-business-phone]').forEach((link) => {
      link.href = 'tel:' + digits;
      link.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) node.textContent = node.textContent.replace(defaultPhone, visible); });
    });
    window.WILD_SUN_BUSINESS_PHONE = { label: visible, href: 'tel:' + digits };
    document.dispatchEvent(new CustomEvent('wildsun:business-settings', { detail: { phone: visible, phoneHref: 'tel:' + digits } }));
  }
  function formatTime(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d/.test(String(value))) return '';
    const [hours, minutes] = String(value).split(':').map(Number);
    return String(hours % 12 || 12) + (minutes ? ':' + String(minutes).padStart(2, '0') : '') + (hours >= 12 ? 'pm' : 'am');
  }
  function applyHours(payload) {
    const rows = Array.isArray(payload.store_hours) ? payload.store_hours : [];
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const ordered = rows.map((row) => ({ ...row, index: Number(row.day_of_week) })).filter((row) => row.index >= 0 && row.index <= 6).sort((a, b) => (a.index + 6) % 7 - (b.index + 6) % 7);
    if (ordered.length !== 7) return;
    document.querySelectorAll('[data-business-hours]').forEach((container) => {
      container.replaceChildren();
      ordered.forEach((row) => {
        const line = document.createElement('div');
        const day = document.createElement('span');
        const time = document.createElement('strong');
        day.textContent = names[row.index];
        time.textContent = row.is_open && formatTime(row.open_time) && formatTime(row.close_time) ? formatTime(row.open_time) + ' to ' + formatTime(row.close_time) : 'Closed';
        line.append(day, time); container.append(line);
      });
    });
    const today = payload.today;
    if (today && typeof today.is_open === 'boolean') {
      const summary = today.is_open && formatTime(today.open_time) && formatTime(today.close_time) ? 'Today: ' + formatTime(today.open_time) + ' to ' + formatTime(today.close_time) : 'Closed today';
      document.querySelectorAll('[data-today-hours]').forEach((element) => { element.textContent = summary; });
    }
  }
  async function getJson(path) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 5000);
    try { const response = await fetch(base + path, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal }); if (!response.ok) throw new Error('Settings unavailable'); return await response.json(); }
    finally { clearTimeout(timeout); }
  }
  async function init() {
    let settings;
    try { settings = await getJson('/api/settings/public'); } catch (_) { return; }
    if (!/wild.*sun/i.test(String(settings.restaurant_name || ''))) return;
    if (settings.restaurant_name) document.querySelectorAll('[data-business-name]').forEach((element) => { element.textContent = settings.restaurant_name; });
    if (settings.phone) setPhone(settings.phone);
    if (settings.address) {
      const address = String(settings.address);
      document.querySelectorAll('[data-business-address]').forEach((element) => { element.textContent = address; });
      document.querySelectorAll('[data-directions]').forEach((element) => { element.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(address); });
    }
    try { applyHours(await getJson('/api/settings/hours')); } catch (_) { /* Static hours remain visible. */ }
  }
  init();
})();
