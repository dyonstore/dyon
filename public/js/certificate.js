/* DYON §11 — certificate of kept commitments. The server checks and publishes; the ledger never leaves the device.
   Sent: { total, done, name } — three values. "Settled" = fulfilled or released. */
import { t, formatNumber } from './i18n.js';
import * as S from './store.js';
import * as ACCT from './account.js';
import { el, icon, toast, copyText, confirmSheet } from './ui.js';
import { qrCanvas } from './qr.js';
import { openSignInSheet } from './account-aside.js';

export const SETTLED = ['fulfilled', 'released'];

/** Counts for the certificate. T-10 (private spiritual items) never counts, and neither does anything archived or written off. */
export function counts() {
  const all = S.visibleCommitments().filter(c => c.status !== 'archived' && c.status !== 'draft');
  return { total: all.length, done: all.filter(c => SETTLED.includes(c.status)).length };
}
export const percent = (done, total) => (total > 0 ? Math.floor(100 * done / total) : 0);

async function api(path, { method = 'GET', body, retry = true } = {}) {
  let res;
  try {
    res = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store',
      headers: Object.assign({ Accept: 'application/json' }, method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': ACCT.csrfToken() }),
      body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { const e = new Error('offline'); e.code = 'offline'; throw e; }
  let j = null; try { j = await res.json(); } catch { /* not json */ }
  if (res.ok) return j;
  const code = (j && j.error && j.error.code) || 'http_' + res.status;
  if (res.status === 403 && code === 'csrf' && retry) { await ACCT.refresh(); return api(path, { method, body, retry: false }); }
  const e = new Error(code); e.code = code; e.status = res.status; throw e;
}

export function renderCertificate() {
  const root = el('div', { class: 'stack fade-in', id: 'cert-view' });
  let server;              // undefined = loading, null = none, object = certificate
  let busy = false;
  let loadErr = false;

  const num = (n) => formatNumber(n);
  const head = () => [
    el('h1', { text: t('cert.title') }),
    el('p', { class: 'lead', text: t('cert.lead') }),
    el('p', { class: 'hint', text: t('cert.settled_means') })
  ];

  async function load() {
    const me = ACCT.current();
    if (!me || !me.signed_in) { server = null; paint(); return; }
    try { server = (await api('/api/cert.php')).certificate; loadErr = false; }
    catch (e) { server = null; loadErr = true; }
    paint();
  }

  async function publish(name) {
    if (busy) return; busy = true; paint();
    const { total, done } = counts();
    const had = !!server;
    try {
      server = (await api('/api/cert.php', { method: 'POST', body: { action: 'issue', total, done, name } })).certificate;
      toast(t(had ? 'cert.updated' : 'cert.published'), 'good');
    } catch (e) { toast(t(e.code === 'offline' ? 'cert.offline' : 'cert.error'), 'warn'); }
    busy = false; paint();
  }

  function paint() {
    const me = ACCT.current();
    const { total, done } = counts();
    const kids = head();
    if (!me || !me.signed_in) {
      kids.push(el('section', { class: 'card' }, [
        el('p', { text: t('cert.need_account') }),
        el('button', { class: 'btn btn-primary', type: 'button', id: 'cert-signin',
          onclick: () => openSignInSheet({ title: t('cert.sign_in'), intro: t('cert.sign_in_intro') }) }, [icon('fa-right-to-bracket'), el('span', { text: t('cert.sign_in') })])
      ]));
    } else if (server === undefined) {
      kids.push(el('p', { class: 'hint', text: '…' }));
    } else {
      kids.push(el('section', { class: 'card', id: 'cert-now' }, [
        el('b', { id: 'cert-counts', text: total ? t('cert.now', { done: num(done), total: num(total), pct: num(percent(done, total)) }) : t('cert.empty') })
      ]));
      if (loadErr) kids.push(el('p', { class: 'notice', text: t('cert.offline') }));
      const nameIn = el('input', { type: 'text', id: 'cert-name', maxlength: 60, autocomplete: 'off',
        value: server ? server.name : (S.state.settings.display_name || '') });
      kids.push(el('section', { class: 'card stack' }, [
        el('label', { for: 'cert-name' }, [el('span', { text: t('cert.name') })]),
        nameIn,
        el('div', { class: 'hint', text: t('cert.name_hint') }),
        el('p', { class: 'notice', text: t('cert.what_sent') }),
        el('button', { class: 'btn btn-primary', type: 'button', id: 'cert-publish', disabled: (busy || !total) ? '' : null,
          onclick: () => publish(nameIn.value) }, [icon('fa-shield-halved'), el('span', { text: t(server ? 'cert.refresh' : 'cert.publish') })])
      ]));
      if (server) kids.push(liveCard(server, total, done));
    }
    kids.push(el('p', { class: 'notice', id: 'cert-limits', text: t('cert.limits') }));
    root.replaceChildren(...kids.filter(Boolean));
  }

  function liveCard(c, total, done) {
    const canvas = qrCanvas(c.url, { label: 'DYON · ' + t('nav.certificate') });
    canvas.setAttribute('aria-label', t('cert.qr_label'));
    const stale = c.total !== total || c.done !== done;
    return el('section', { class: 'card stack', id: 'cert-live' }, [
      el('div', { class: 'qr-card' }, [
        canvas,
        el('b', { class: 'qr-summary', id: 'cert-live-line', text: t('cert.live', { pct: num(c.percent), done: num(c.done), total: num(c.total) }) }),
        el('small', { dir: 'ltr', id: 'cert-url', text: c.url })
      ]),
      stale ? el('p', { class: 'notice', id: 'cert-stale', text: t('cert.stale') }) : null,
      el('div', { class: 'row tight qr-actions' }, [
        el('button', { class: 'btn btn-sm', type: 'button', id: 'cert-copy', onclick: async () => { await copyText(c.url); toast(t('remind.copied'), 'good'); } },
          [icon('fa-link'), el('span', { text: t('cert.copy_link') })]),
        el('button', { class: 'btn btn-sm', type: 'button', id: 'cert-save', onclick: () => canvas.toBlob(b => {
          const a = el('a', { href: URL.createObjectURL(b), download: 'dyon-certificate.png' });
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
        }, 'image/png') }, [icon('fa-download'), el('span', { text: t('cert.save_qr') })]),
        el('a', { class: 'btn btn-sm', id: 'cert-open', href: new URL(c.url).pathname, target: '_blank', rel: 'noopener' },
          [icon('fa-eye'), el('span', { text: t('cert.open_public') })]),
        el('button', { class: 'btn btn-sm', type: 'button', id: 'cert-withdraw', onclick: () => confirmSheet({
          title: t('cert.withdraw'), message: t('cert.withdraw_msg'), confirmLabel: t('cert.withdraw'), danger: true,
          onConfirm: async () => {
            try { await api('/api/cert.php', { method: 'POST', body: { action: 'revoke' } }); server = null; toast(t('cert.withdrawn'), 'good'); paint(); }
            catch (e) { toast(t(e.code === 'offline' ? 'cert.offline' : 'cert.error'), 'warn'); }
          } }) }, [icon('fa-ban'), el('span', { text: t('cert.withdraw') })])
      ])
    ]);
  }

  paint();
  load();
  return root;
}
