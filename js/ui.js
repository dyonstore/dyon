/* DYON — UI primitives: safe DOM building, chips, cards, sheets, toasts.
   No innerHTML with user data anywhere; every node is created explicitly. */

import { t, formatDate, formatDateDual, getLocale, formatNumber } from './i18n.js';
import { formatAmount, speakAmount, unitShort } from './units.js';
import * as S from './store.js';

/* ---------- element factory ---------- */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;            // only for trusted static markup
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}
export const frag = (children) => {
  const f = document.createDocumentFragment();
  [].concat(children).filter(Boolean).forEach(c => f.appendChild(c));
  return f;
};
export function icon(name, extra = '') {
  return el('i', { class: `fa-solid ${name} ${extra}`.trim(), 'aria-hidden': 'true' });
}
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

/* ---------- toasts ---------- */
let toastWrap;
export function toast(message, kind = '', action) {
  if (!toastWrap) {
    toastWrap = el('div', { class: 'toast-wrap', id: 'toast-wrap', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastWrap);
  }
  const node = el('div', { class: `toast ${kind}` }, [
    el('span', { text: message, style: { flex: '1' } }),
    action ? el('button', {
      class: 'btn btn-sm', text: action.label,
      onclick: () => { action.onClick(); node.remove(); }
    }) : null
  ]);
  toastWrap.appendChild(node);
  if (!(action && action.persist)) setTimeout(() => node.remove(), action ? 9000 : 4200);
  return node;
}

/* ---------- sheet (side / bottom panel) ---------- */
let scrim, openSheet = null;
function ensureScrim() {
  if (!scrim) {
    scrim = el('div', { class: 'scrim', id: 'app-scrim', onclick: () => closeSheet() });
    document.body.appendChild(scrim);
  }
  return scrim;
}
export function sheet({ title, body, footer, onClose, wide }) {
  closeSheet(true);
  ensureScrim();
  const panel = el('aside', {
    class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Panel',
    style: wide ? { width: 'min(760px, 100%)' } : {}
  }, [
    el('header', { class: 'sheet-head' }, [
      el('h2', { text: title || '' }),
      el('div', { style: { flex: '1' } }),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('action.close'), onclick: () => closeSheet() }, [icon('fa-xmark')])
    ]),
    el('div', { class: 'sheet-body' }, [body]),
    footer ? el('footer', { class: 'sheet-foot' }, footer) : null
  ]);
  document.body.appendChild(panel);
  requestAnimationFrame(() => { scrim.classList.add('open'); panel.classList.add('open'); });
  document.body.classList.add('sheet-open');
  const opener = document.activeElement;
  openSheet = { panel, onClose, opener };
  /* On touch screens, auto-focusing an input pops the keyboard over half the
     sheet before the person has even read it. Focus the panel instead. */
  const coarse = matchMedia('(pointer: coarse)').matches;
  panel.setAttribute('tabindex', '-1');
  const focusable = coarse ? null : panel.querySelector('.sheet-body input:not([type="checkbox"]), .sheet-body select, .sheet-body textarea');
  setTimeout(() => (focusable || panel).focus({ preventScroll: true }), 320);
  return panel;
}
export function closeSheet(instant) {
  if (!openSheet) return;
  const { panel, onClose, opener } = openSheet;
  openSheet = null;
  panel.classList.remove('open');
  if (scrim) scrim.classList.remove('open');
  document.body.classList.remove('sheet-open');
  if (!instant && opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
  const done = () => { panel.remove(); onClose && onClose(); };
  instant ? done() : setTimeout(done, 300);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
/* A navigation (bottom bar, back button) must never leave a sheet floating
   over the new screen. */
window.addEventListener('hashchange', () => closeSheet(true));
export function sheetOpen() { return !!openSheet; }

/* ---------- confirm dialog ---------- */
export function confirmSheet({ title, message, confirmLabel, danger, onConfirm, extra }) {
  const body = el('div', { class: 'stack' }, [
    el('p', { text: message }),
    extra || null
  ]);
  sheet({
    title,
    body,
    footer: [
      el('button', { class: 'btn', type: 'button', text: t('action.cancel'), onclick: () => closeSheet() }),
      el('button', {
        type: 'button',
        class: 'btn ' + (danger ? 'btn-warn' : 'btn-primary'),
        text: confirmLabel || t('action.confirm'),
        onclick: () => { closeSheet(); onConfirm(); }
      })
    ]
  });
}

/* ---------- form field helpers ----------
   `control` may be a real form element, a wrapper div (chip groups), or a
   DocumentFragment. Only a real element can carry an id / aria attributes, so
   everything else is labelled with a plain <span> instead of <label for>. */
export function field(labelText, control, hint, opts = {}) {
  const labellable = control instanceof Element &&
    /^(input|select|textarea)$/i.test(control.tagName);
  let label;
  if (labellable) {
    const id = control.id || ('f_' + Math.random().toString(36).slice(2, 8));
    control.id = id;
    if (opts.required) control.setAttribute('aria-required', 'true');
    label = el('label', { for: id }, [
      el('span', { text: labelText }),
      opts.required ? el('span', { class: 'req', text: ' *', title: 'required' }) : null
    ]);
  } else {
    label = el('span', { class: 'label' }, [
      el('span', { text: labelText }),
      opts.required ? el('span', { class: 'req', text: ' *', title: 'required' }) : null
    ]);
  }
  return el('div', { class: 'field' }, [
    label,
    control,
    hint ? el('div', { class: 'hint', text: hint }) : null
  ]);
}
export function input(props = {}) { return el('input', Object.assign({ type: 'text' }, props)); }
export function textarea(props = {}) { return el('textarea', props); }
export function select(options, props = {}) {
  const s = el('select', props);
  for (const o of options) {
    if (o.group) {
      const g = el('optgroup', { label: o.group });
      o.options.forEach(x => g.appendChild(el('option', { value: x.value, text: x.label, selected: x.selected })));
      s.appendChild(g);
    } else {
      s.appendChild(el('option', { value: o.value, text: o.label, selected: o.selected }));
    }
  }
  return s;
}
export function switchRow(labelText, checked, onChange, hint) {
  const inp = el('input', { type: 'checkbox', checked, onchange: e => onChange(e.target.checked) });
  return el('div', { class: 'setting' }, [
    el('div', { class: 's-main' }, [
      el('b', { text: labelText }),
      hint ? el('small', { text: hint }) : null
    ]),
    el('label', { class: 'switch' }, [inp, el('span', { class: 'track' })])
  ]);
}
export function settingRow(labelText, control, hint) {
  return el('div', { class: 'setting' }, [
    el('div', { class: 's-main' }, [
      el('b', { text: labelText }),
      hint ? el('small', { text: hint }) : null
    ]),
    control
  ]);
}

/* ---------- chips ---------- */
export function chipGroup(items, value, onPick, opts = {}) {
  const wrap = el('div', { class: 'row tight', role: opts.radio === false ? null : 'radiogroup' });
  items.forEach(it => {
    const b = el('button', {
      type: 'button',
      class: 'chip' + (it.value === value ? ' on' : ''),
      'aria-pressed': it.value === value ? 'true' : 'false',
      onclick: () => onPick(it.value)
    }, [it.icon ? icon(it.icon) : null, el('span', { text: it.label })]);
    wrap.appendChild(b);
  });
  return wrap;
}

/* ---------- display helpers ---------- */
export function statusBadge(status) {
  const map = {
    fulfilled: ['badge-good', 'fa-circle-check'],
    released: ['badge-good', 'fa-dove'],
    settled: ['badge-good', 'fa-handshake'],
    proposed: ['badge-needs', 'fa-hourglass-half'],
    disputed: ['badge-dispute', 'fa-comments'],
    respite: ['badge-needs', 'fa-clock'],
    partial: ['', 'fa-circle-half-stroke'],
    acknowledged: ['', 'fa-check-double'],
    active: ['', 'fa-circle-dot'],
    draft: ['', 'fa-pen'],
    transferred: ['', 'fa-right-left'],
    written_off: ['', 'fa-eraser'],
    archived: ['', 'fa-box-archive']
  };
  const [cls, ic] = map[status] || ['', 'fa-circle-dot'];
  return el('span', { class: 'badge ' + cls }, [icon(ic), el('span', { text: t('status.' + status) })]);
}
export function directionBadge(dir) {
  const cls = dir === 'I_OWE' ? 'badge-owe' : dir === 'OWED_TO_ME' ? 'badge-owed' : '';
  const ic = dir === 'I_OWE' ? 'fa-arrow-up-long' : dir === 'OWED_TO_ME' ? 'fa-arrow-down-long' : 'fa-arrows-left-right';
  const key = dir === 'I_OWE' ? 'dir.i_owe' : dir === 'OWED_TO_ME' ? 'dir.owed_to_me' : 'dir.mutual';
  return el('span', { class: 'badge ' + cls }, [icon(ic), el('span', { text: t(key) })]);
}
export function avatar(name, idx = 0, size = '') {
  const initials = (name || '—').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('');
  return el('span', {
    class: `avatar ${size} k${(idx % 5) + 1}`, 'aria-hidden': 'true', text: initials
  });
}

/* Amount element with privacy blur (R-D06) and screen-reader text */
export function amountEl(minor, unit, opts = {}) {
  const blurDefault = S.state.settings.blur_amounts || (S.state.settings.calm_mode && opts.calmHide);
  const span = el('span', {
    class: `amount ${opts.size || ''} blurable${blurDefault ? ' blurred' : ''}`,
    tabindex: blurDefault ? '0' : null,
    role: blurDefault ? 'button' : null,
    'aria-label': speakAmount(minor, unit)
  }, [el('span', { text: formatAmount(minor, unit, { symbol: opts.symbol }) })]);
  if (blurDefault) {
    const reveal = () => span.classList.toggle('blurred');
    span.addEventListener('click', reveal);
    span.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); } });
  }
  return span;
}

export function dueLabel(c) {
  if (c.due_mode === 'when_able') return t('status.when_able');
  if (c.due_mode === 'on_return') return t('status.on_return');
  if (c.due_mode === 'recurring') return t('status.recurring');
  if (!c.due_on) return t('status.no_due');
  const d = S.daysUntil(c.due_on);
  const dateTxt = formatDateDual(c.due_on);
  if (d === null) return dateTxt;
  if (d === 0) return t('time.due_today');
  if (d < 0) return t('time.overdue_by', { count: Math.abs(d) });
  if (d <= 30) return t('time.due_in', { count: d });
  return dateTxt;
}

export function card({ title, wid, sub, actions, body, accent, cls }) {
  return el('section', { class: `card ${accent ? 'card-accent' : ''} ${cls || ''}`.trim() }, [
    (title || actions) ? el('div', { class: 'card-head' }, [
      title ? el('h3', {}, [
        el('span', { text: title }),
        wid ? el('span', { class: 'wid', text: wid }) : null
      ]) : null,
      el('div', { class: 'spacer' }),
      ...(actions || [])
    ]) : null,
    sub ? el('p', { class: 'card-sub', text: sub }) : null,
    body
  ]);
}

export function emptyState(iconName, title, text, action) {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'ei' }, [icon(iconName)]),
    el('h3', { text: title }),
    text ? el('p', { text }) : null,
    action || null
  ]);
}

export function progressBar(pct, good) {
  return el('div', {
    class: 'progress' + (good ? ' good' : ''), role: 'progressbar',
    'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100'
  }, [el('i', { style: { width: Math.max(0, Math.min(100, pct)) + '%' } })]);
}

export function meterRing(value, label) {
  const r = 44, circ = 2 * Math.PI * r;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '104'); svg.setAttribute('height', '104'); svg.setAttribute('aria-hidden', 'true');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = '<linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#6366f1"/><stop offset="60%" stop-color="#8b5cf6"/>' +
    '<stop offset="100%" stop-color="#14b8a6"/></linearGradient>';
  svg.appendChild(defs);
  const mk = (stroke, dash) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', '52'); c.setAttribute('cy', '52'); c.setAttribute('r', String(r));
    c.setAttribute('fill', 'none'); c.setAttribute('stroke', stroke);
    c.setAttribute('stroke-width', '9'); c.setAttribute('stroke-linecap', 'round');
    if (dash) { c.setAttribute('stroke-dasharray', `${dash} ${circ}`); }
    return c;
  };
  svg.appendChild(mk('var(--surface-3)'));
  svg.appendChild(mk('url(#ringGrad)', circ * Math.max(0, Math.min(100, value)) / 100));
  return el('div', { class: 'meter-ring', role: 'img', 'aria-label': `${label}: ${value}` }, [
    svg, el('span', { class: 'mval', text: formatNumber(value) })
  ]);
}

export function sparkline(values, max) {
  const m = max || Math.max(1, ...values);
  return el('div', { class: 'spark', 'aria-hidden': 'true' },
    values.map(v => el('i', { style: { height: Math.max(3, (v / m) * 100) + '%' } })));
}

export function disclaimer(kind = 'legal') {
  return el('p', { class: 'notice', text: t(kind === 'fiqh' ? 'fiqh.disclaimer' : 'legal.disclaimer') });
}

export function ayahBlock(item, dismissKey) {
  if (!item) return null;
  const box = el('div', { class: 'notice islamic stack' }, [
    el('div', { class: 'ayah', text: item.ar }),
    el('div', { text: item.en, style: { fontSize: '.84rem' } }),
    el('div', { class: 'row between' }, [
      el('small', { text: item.src + (item.grading ? ' · ' + item.grading : ''), style: { color: 'var(--text-3)' } }),
      dismissKey ? el('button', { class: 'btn btn-sm btn-ghost', text: t('action.close'), onclick: () => box.remove() }) : null
    ]),
    item.note ? el('small', { text: item.note, style: { color: 'var(--text-3)' } }) : null
  ]);
  return box;
}

/* Commitment list row */
export function commitmentRow(c, onOpen) {
  const cp = S.cpOf(c.counterparty_id);
  const idx = S.state.counterparties.findIndex(x => x.id === c.counterparty_id);
  const rem = S.remainingMinor(c);
  const overdue = c.due_on && S.daysUntil(c.due_on) < 0 && S.OPEN_STATUSES.includes(c.status);
  return el('li', {}, [
    el('button', { class: 'item-row', type: 'button', onclick: () => onOpen(c.id) }, [
      avatar(cp ? cp.alias : '—', Math.max(0, idx)),
      el('span', { class: 'item-main' }, [
        el('b', { text: (c.description || t('type.' + c.type)) }),
        el('small', {}, [
          el('span', { text: (cp ? cp.alias : '—') + ' · ' + t('type.' + c.type) + ' · ' }),
          el('span', { text: dueLabel(c), style: overdue ? { color: 'var(--needs)', fontWeight: '700' } : {} })
        ])
      ]),
      el('span', { class: 'item-end stack', style: { gap: '4px', alignItems: 'flex-end' } }, [
        c.amount_minor ? amountEl(rem, c.unit_code, { calmHide: true }) : el('span', { class: 'badge', text: t('status.' + c.status) }),
        el('span', { class: 'row tight' }, [
          directionBadge(c.direction),
          c.approximate ? el('span', { class: 'badge', text: t('status.approximate') }) : null
        ])
      ])
    ])
  ]);
}

/* Keyboard shortcut registry (§7.15) */
const shortcuts = new Map();
export function registerShortcut(key, fn) { shortcuts.set(key.toLowerCase(), fn); }
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
  const fn = shortcuts.get(e.key.toLowerCase());
  if (fn) { e.preventDefault(); fn(); }
});

export function download(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = el('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
    return true;
  }
}
