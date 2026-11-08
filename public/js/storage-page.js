/* DYON §6.5 — progressive enhancement for /storage: shows what THIS browser reports. Nothing is sent anywhere. */
import { info, keep, formatBytes, statusKey } from './storage.js';

const box = document.getElementById('live'); if (box) run();
async function run() {
  const D = box.dataset, lang = document.documentElement.lang || 'en';
  const fmt = (n, o) => new Intl.NumberFormat(lang + '-u-nu-latn', o).format(n);
  const status = document.getElementById('live-status'), used = document.getElementById('live-used'), btn = document.getElementById('live-keep'), msg = document.getElementById('live-msg');
  const paint = async () => {
    const i = await info();
    status.textContent = D[statusKey(i).replace('storage.', '').replace(/_(\w)/g, (_, c) => c.toUpperCase())] || '';
    used.textContent = i.usage != null ? (i.quota ? D.used.replace('{used}', formatBytes(i.usage, fmt)).replace('{quota}', formatBytes(i.quota, fmt)) : D.usedOnly.replace('{used}', formatBytes(i.usage, fmt))) : '';
    btn.hidden = !(i.canPersist && i.persisted !== true);
    box.hidden = false;
  };
  btn.addEventListener('click', async () => {
    btn.disabled = true; const r = await keep();
    msg.textContent = r === 'granted' ? D.keepGranted : r === 'declined' ? D.keepDeclined : D.keepError;
    btn.disabled = false; await paint();
  });
  await paint();
}
