/* DYON — account aside (v2.0 §5). Opened by the header avatar button (#acct-btn) or the U shortcut.
   Reuses aside.js: focus trap, Esc, scrim, inline-end anchoring (start side in RTL), focus returns to the opener.
   Signed out it explains Stage 1 (no account needed) and always offers "Export my data" (RL-09). Signed in it shows
   the picture (same-origin proxy only — CSP), name, email, member-since, local stats (hidden in Calm mode), the sync
   status (green / amber / grey, never red) and Sync settings · Devices · Export · Sign out. */

import { t, formatNumber, formatDate } from './i18n.js';
import * as S from './store.js';
import * as AUTH from './auth.js';
import { AUTH_CONFIG } from './auth-config.js';
import * as A from './account.js';
import { el, icon, toast, download, sheet } from './ui.js';
import { openAside, closeAside } from './aside.js';

/* 32 / 56 px picture with the initial-on-gradient fallback. Never hot-links a provider. */
export function avatarNode(id, size = 32) {
  const fallback = () => el('span', { class: 'acct-fallback', 'aria-hidden': 'true', text: A.initialOf(id.name, id.email) });
  if (!id.avatar) return fallback();
  const img = el('img', { class: 'acct-photo', src: id.avatar, alt: '', width: size, height: size, decoding: 'async', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => img.replaceWith(fallback()), { once: true });
  return img;
}

function syncDot(status, inline) {
  return el('span', { class: 'sync-dot ' + status + (inline ? ' inline' : ''), 'data-sync': status, 'aria-hidden': 'true' });
}

/* Repaints the header button IN PLACE (never replaced, so focus and aria-expanded survive a state change). */
export function paintAccountButton(btn) {
  const id = A.identity(AUTH.session());
  const status = A.syncStatus();
  if (id) {
    const name = id.name || id.email || t('acct.title');
    btn.setAttribute('aria-label', t('acct.btn_with_sync', { name, status: t('acct.sync.' + status) }));
    btn.title = t('acct.btn_signed_in', { name });
    btn.replaceChildren(el('span', { class: 'acct-wrap' }, [avatarNode(id, 32), syncDot(status, false)]));
    btn.classList.add('signed-in');
  } else {
    btn.setAttribute('aria-label', t('acct.btn_signed_out'));
    btn.title = t('acct.btn_signed_out');
    btn.replaceChildren(icon('fa-user'));
    btn.classList.remove('signed-in');
  }
}

export function accountButton(onOpen) {
  const btn = el('button', {
    class: 'icon-btn acct-btn', id: 'acct-btn', type: 'button', 'data-tour': 'account',
    'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'aside-acct',
    onclick: (e) => onOpen(e.currentTarget)
  });
  paintAccountButton(btn);
  return btn;
}

function exportMine() {
  download('dyon-backup-' + S.todayISO() + '.json', JSON.stringify(S.exportPayload(false), null, 2));
  toast(t('acct.exported'), 'good');
}

/* `inSheet`: opened from a Settings card, not from the header avatar — keep the person where they are. */
function providerButtons(inSheet = false) {
  const out = [];
  const back = encodeURIComponent('/' + (location.hash || '#/settings'));
  for (const id of A.serverProviders()) {
    const p = AUTH.PROVIDERS[id]; if (!p) continue;
    out.push(el('a', { class: 'btn btn-block social-btn social-' + id, href: '/api/auth/start.php?provider=' + id + '&return=' + back, 'data-provider': id },
      [icon(p.icon), el('span', { text: t('acct.sign_in_provider', { provider: p.label }) })]));
  }
  // Legacy / preview sign-in (client-side providers, or localhost preview) stays available through the existing sheet.
  if (AUTH.anyProviderConfigured() || AUTH_CONFIG.allowPreview) {
    out.push(el('button', { class: 'btn btn-block' + (out.length ? '' : ' btn-primary'), type: 'button', id: 'acct-more-signin',
      onclick: () => { if (!inSheet) closeAside(true); setTimeout(() => AUTH.openSignIn(), 40); } },
      [icon('fa-right-to-bracket'), el('span', { text: out.length ? t('acct.sign_in_more') : t('app.link_account') })]));
  }
  return out;
}

function signedOutBody() {
  const buttons = providerButtons();
  return el('div', { class: 'stack acct-out' }, [
    el('div', { class: 'acct-hero' }, [el('span', { class: 'acct-fallback', 'aria-hidden': 'true' }, [icon('fa-user')]),
      el('div', { class: 'item-main' }, [el('b', { text: t('acct.out.headline') }), el('small', { text: t('acct.out.stage') })])]),
    el('p', { text: t('acct.out.body') }),
    buttons.length ? el('div', { class: 'stack', style: { gap: '8px' } }, buttons) : null,
    el('button', { class: 'btn btn-block', type: 'button', id: 'acct-export', onclick: exportMine },
      [icon('fa-file-export'), el('span', { text: t('acct.export') })]),
    el('p', { class: 'hint', text: t('acct.out.export_note') }),
    el('p', { class: 'hint', text: t('acct.shortcut') })
  ]);
}

function statsBlock() {
  if (S.state.settings.calm_mode) return el('p', { class: 'hint', id: 'acct-stats-hidden', text: t('acct.stats_hidden') });
  const people = S.state.counterparties.length, open = S.openCommitments().length;
  return el('div', { class: 'acct-stats', id: 'acct-stats' }, [
    el('div', {}, [el('b', { text: formatNumber(people) }), el('small', { text: t('acct.stat.people', { count: people }) })]),
    el('div', {}, [el('b', { text: formatNumber(open) }), el('small', { text: t('acct.stat.open', { count: open }) })])
  ]);
}

function signedInBody(id) {
  const status = A.syncStatus();
  const p = AUTH.PROVIDERS[id.provider];
  const since = id.created ? formatDate(new Date(id.created * 1000).toISOString().slice(0, 10)) : '';
  const link = (href, ic, text) => el('li', {}, [el('a', { class: 'item-row', href, onclick: () => closeAside(true) },
    [icon(ic), el('span', { class: 'item-main', text })])]);
  const signOutBtn = el('button', { class: 'btn btn-block', type: 'button', id: 'acct-signout' },
    [icon('fa-right-from-bracket'), el('span', { text: t('acct.sign_out') })]);
  signOutBtn.addEventListener('click', async () => {
    signOutBtn.disabled = true;
    if (id.source === 'local') { await AUTH.signOut(); closeAside(); return; }     // preview/legacy link: auth.js toasts
    const ok = await A.signOut();
    if (ok) { toast(t('acct.signed_out'), 'good'); closeAside(); }
    else { signOutBtn.disabled = false; toast(t('acct.sign_out_failed'), 'warn'); }
  });
  return el('div', { class: 'stack acct-in' }, [
    el('div', { class: 'acct-hero' }, [avatarNode(id, 56), el('div', { class: 'item-main' }, [
      el('b', { id: 'acct-name', text: id.name || (p ? p.label : t('acct.title')) }),
      id.email ? el('small', { id: 'acct-email', text: id.email }) : null,
      since ? el('small', { id: 'acct-since', text: t('acct.member_since', { date: since }) }) : null
    ])]),
    id.preview ? el('span', { class: 'badge badge-needs', text: t('acct.preview_badge') }) : null,
    el('p', { class: 'acct-sync', id: 'acct-sync', 'data-sync': status }, [syncDot(status, true), el('span', { text: t('acct.sync.' + status) })]),
    statsBlock(),
    el('ul', { class: 'listy' }, [
      link('#/settings?s=sync', 'fa-rotate', t('acct.link.sync')),
      link('#/settings?s=devices', 'fa-laptop-mobile', t('acct.link.devices')),
      link('#/settings?s=account', 'fa-user-gear', t('acct.link.account')),
      el('li', {}, [el('button', { class: 'item-row', type: 'button', id: 'acct-export', onclick: exportMine },
        [icon('fa-file-export'), el('span', { class: 'item-main', text: t('acct.export') })])])
    ]),
    signOutBtn
  ]);
}

export function openAccountAside(opener) {
  opener = opener || document.getElementById('acct-btn');
  const id = A.identity(AUTH.session());
  return openAside({ id: 'acct', title: t('acct.title'), body: id ? signedInBody(id) : signedOutBody(), opener });
}

/* Sign-in from a Settings card (e.g. Sync). A small sheet with the providers — never the account aside, which is
   for people who are already signed in or who asked for it from the header. After sign-in the server sends the
   browser back to the same Settings screen. */
export function openSignInSheet({ title, intro } = {}) {
  const buttons = providerButtons(true);
  sheet({
    title: title || t('app.link_account'),
    body: el('div', { class: 'stack' }, [
      intro ? el('p', { text: intro }) : null,
      el('p', { class: 'hint', text: t('auth.private_ledger_keeps_working') }),
      el('div', { class: 'stack', style: { gap: '8px' } }, buttons)
    ])
  });
}
