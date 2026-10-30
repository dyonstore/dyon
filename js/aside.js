/* DYON — toggled aside (v2.0 §2.5, §5.2).
   A modal panel that slides from the inline-end side (start side in RTL —
   logical CSS properties handle the flip). Esc or the scrim closes it; focus
   is trapped inside and returned to the opener. It never touches the route
   or history. One aside at a time; opening the same id again closes it. */

import { t } from './i18n.js';
import { el, icon, closeSheet } from './ui.js';

let state = null;

export function asideOpen(id) { return !!state && (!id || state.id === id); }

export function closeAside(instant) {
  if (!state) return;
  const { panel, scrim, opener, onClose, keyHandler } = state;
  state = null;
  document.removeEventListener('keydown', keyHandler, true);
  panel.classList.remove('open');
  scrim.classList.remove('open');
  document.body.classList.remove('aside-open');
  if (opener && opener.setAttribute) opener.setAttribute('aria-expanded', 'false');
  if (opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
  const done = () => { panel.remove(); scrim.remove(); if (onClose) onClose(); };
  if (instant) done(); else setTimeout(done, 260);
}

export function openAside({ id, title, body, opener, onClose }) {
  if (state && state.id === id) { closeAside(); return null; }
  closeAside(true);
  closeSheet(true);
  const headingId = 'aside-title-' + id;
  const scrim = el('div', { class: 'aside-scrim', 'data-aside-scrim': id, onclick: () => closeAside() });
  const panel = el('aside', {
    class: 'side-aside', id: 'aside-' + id, role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': headingId, tabindex: '-1'
  }, [
    el('header', { class: 'aside-head' }, [
      el('h2', { id: headingId, text: title }),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('action.close'), onclick: () => closeAside() }, [icon('fa-xmark')])
    ]),
    el('div', { class: 'aside-body' }, [body])
  ]);
  document.body.append(scrim, panel);
  document.body.classList.add('aside-open');
  if (opener) opener.setAttribute('aria-expanded', 'true');

  const focusables = () => [...panel.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(n => n.getClientRects().length);
  const keyHandler = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeAside(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) { e.preventDefault(); panel.focus(); return; }
    const first = f[0], last = f[f.length - 1];
    if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', keyHandler, true);
  state = { id, panel, scrim, opener, onClose, keyHandler };
  requestAnimationFrame(() => { scrim.classList.add('open'); panel.classList.add('open'); });
  const coarse = matchMedia('(pointer: coarse)').matches;
  const search = !coarse && panel.querySelector('.aside-body input[type="search"]');
  setTimeout(() => (search || panel).focus({ preventScroll: true }), 30);
  return panel;
}

/* A real navigation closes it (the aside itself never navigates). */
window.addEventListener('hashchange', () => closeAside(true));
