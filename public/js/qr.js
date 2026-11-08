/* DYON — request QR codes.

   Every request DYON helps a user send to another person (confirm this record,
   a payment reminder, a respite request, a settlement proposal, a witness
   invitation, a thank-you) can be shown as a QR code with the DYON mark in the
   middle. Scanning it opens DYON at #/r?d=… — a read-only card describing that
   ONE request, with an option to copy it into the scanner's own ledger.

   Design rules:
   - The payload carries only this one request, never other debts (R-D11).
   - Nothing is uploaded: the data lives inside the QR / link itself.
   - Error correction level H (≈30 %) so the centre logo never breaks a scan;
     the logo covers well under that budget.
   - Scanned payloads are untrusted input: they are schema-checked, clamped
     and rendered as text only. */

import qrcode from './vendor/qrcode-generator.js';
import { t, tr, getDir, formatDate } from './i18n.js';
import { formatAmount, unitShort, isMonetary } from './units.js';
import * as S from './store.js';
import * as AUTH from './auth.js';
import { el, icon, sheet, closeSheet, toast, copyText } from './ui.js';


/* ---------------- payload ---------------- */
export const KINDS = ['confirm', 'remind', 'respite', 'settlement', 'witness', 'thanks'];
const KIND_LABEL = {
  confirm: { en: 'Please confirm this record', ar: 'يُرجى تأكيد هذا السجل', icon: 'fa-check-double' },
  remind: { en: 'A gentle reminder', ar: 'تذكير لطيف', icon: 'fa-paper-plane' },
  respite: { en: 'A request for more time', ar: 'طلب إنظار (مهلة)', icon: 'fa-clock' },
  settlement: { en: 'A settlement proposal (ṣulḥ)', ar: 'اقتراح صلح', icon: 'fa-handshake' },
  witness: { en: 'An invitation to witness', ar: 'دعوة للشهادة', icon: 'fa-users-viewfinder' },
  thanks: { en: 'Thank you', ar: 'شكرًا لك', icon: 'fa-heart' }
};
export const kindLabel = (k) => { const x = KIND_LABEL[k] || KIND_LABEL.confirm; return tr(x); };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const clampStr = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '');

/* Build the compact payload for a commitment + request kind. */
export function buildPayload(kind, c, extra = {}) {
  const acc = AUTH.session();
  const from = clampStr((acc && acc.name) || S.state.settings.display_name || '', 60);
  const p = { v: 1, k: kind, f: from, r: c.direction, u: c.unit_code };
  if (c.amount_minor) p.a = kind === 'settlement' && extra.amount_minor ? extra.amount_minor : S.remainingMinor(c);
  if (c.description) p.d = clampStr(c.description, 80);
  if (c.incurred_on) p.i = c.incurred_on;
  if (c.due_on) p.du = c.due_on;
  if (extra.new_date) p.nd = extra.new_date;
  if (extra.unit_code && extra.unit_code !== c.unit_code) p.u = extra.unit_code;
  if (extra.note) p.m = clampStr(extra.note, 90);   // short: dense codes scan badly
  if (acc && acc.preview) p.pv = 1;
  return p;
}

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
}

export function encodePayload(p) { return b64urlEncode(JSON.stringify(p)); }

/* Strict decode: returns a sanitised payload or null. Never throws. */
export function decodePayload(s) {
  try {
    if (!s || s.length > 1600) return null;
    const raw = JSON.parse(b64urlDecode(s));
    if (!raw || raw.v !== 1 || !KINDS.includes(raw.k)) return null;
    const out = { v: 1, k: raw.k };
    out.f = clampStr(raw.f, 60);
    out.r = ['I_OWE', 'OWED_TO_ME', 'MUTUAL'].includes(raw.r) ? raw.r : 'MUTUAL';
    out.u = typeof raw.u === 'string' && /^[A-Z0-9_]{2,12}$/.test(raw.u) ? raw.u : 'ITEM';
    if (Number.isSafeInteger(raw.a) && raw.a > 0 && raw.a < 1e15) out.a = raw.a;
    if (raw.d) out.d = clampStr(raw.d, 80);
    if (ISO.test(raw.i || '')) out.i = raw.i;
    if (ISO.test(raw.du || '')) out.du = raw.du;
    if (ISO.test(raw.nd || '')) out.nd = raw.nd;
    if (raw.m) out.m = clampStr(raw.m, 90);
    if (raw.pv) out.pv = 1;
    return out;
  } catch { return null; }
}

export function requestURL(p) {
  /* Always point at the app shell (not a preview/test page), with the
     shortest path, so the code stays as sparse — and scannable — as possible. */
  const dir = location.pathname.replace(/[^/]*$/, '');
  return location.origin + dir + '#/r?d=' + encodePayload(p);
}

/* ---------------- drawing ---------------- */
const DARK = '#0b1020';
const LOGO_PATH = 'M168 150c70-22 140 6 150 72 10 66-38 124-114 140-30 6-58 4-84-6';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* The DYON mark — the same artwork as images/icon.svg, drawn natively so it
   is available synchronously and never taints the canvas. */
export function drawLogo(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 512;
  ctx.scale(s, s);
  roundRect(ctx, 0, 0, 512, 512, 112);
  ctx.fillStyle = DARK;
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 512, 512);
  g.addColorStop(0, '#6366f1'); g.addColorStop(0.5, '#8b5cf6'); g.addColorStop(1, '#14b8a6');
  ctx.strokeStyle = g; ctx.fillStyle = g;
  ctx.lineWidth = 40; ctx.lineCap = 'round';
  if (typeof Path2D !== 'undefined') ctx.stroke(new Path2D(LOGO_PATH));
  ctx.beginPath(); ctx.arc(356, 152, 22, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* Render text as a QR code with the DYON logo in the centre.
   Returns a <canvas>. `px` is the internal resolution. */
export function qrCanvas(text, { px = 840, logo = true, label = '' } = {}) {
  const qr = qrcode(0, 'H');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  const cell = Math.floor(px / (n + quiet * 2));
  const qrSize = cell * (n + quiet * 2);
  const labelH = label ? Math.round(cell * 6) : 0;
  const canvas = document.createElement('canvas');
  canvas.width = qrSize; canvas.height = qrSize + labelH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /* Reserve a centre square for the logo: ~20 % of the symbol width (≈4 % of
     the area, far inside level H's ~30 % recovery budget), snapped
     to whole modules, never touching the finder patterns. */
  const logoMods = logo ? Math.max(5, Math.round(n * 0.2) | 1) : 0;
  const start = Math.floor((n - logoMods) / 2);
  const inLogo = (r, c) => logo && r >= start && r < start + logoMods && c >= start && c < start + logoMods;

  ctx.fillStyle = DARK;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c) && !inLogo(r, c)) {
        ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
      }
    }
  }
  if (logo) {
    const box = logoMods * cell;
    const ox = (start + quiet) * cell, oy = (start + quiet) * cell;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, ox, oy, box, box, cell * 1.2);
    ctx.fill();
    const pad = cell * 0.6;
    drawLogo(ctx, ox + pad, oy + pad, box - pad * 2);
  }
  if (label) {
    ctx.fillStyle = DARK;
    ctx.font = `700 ${Math.round(cell * 2.4)}px Inter, "Noto Kufi Arabic", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.direction = getDir();
    ctx.fillText(label.slice(0, 48), qrSize / 2, qrSize + labelH / 2 - cell);
  }
  canvas.className = 'qr-canvas';
  canvas.setAttribute('role', 'img');
  canvas.dataset.modules = String(n);
  return canvas;
}

/* ---------------- sheet ---------------- */
function summaryLine(p) {
  const amt = p.a ? formatAmount(p.a, p.u) : (p.d || unitShort(p.u));
  return amt + (p.d && p.a ? ' · ' + p.d : '');
}

/* Show a request as a QR. Reaching another person is stage 2, so this asks
   for a linked account first (and resumes after sign-in). */
export function openRequestQR(payload) {
  AUTH.requireAuth('qr', payload, () => showQR(payload));
}
AUTH.registerResume('qr', p => p && showQR(p));

function showQR(payload) {
  const url = requestURL(payload);
  const label = 'DYON · ' + kindLabel(payload.k);
  const canvas = qrCanvas(url, { label });
  canvas.setAttribute('aria-label', t('qr.qr_code', { kind: kindLabel(payload.k) }));
  const fileName = `dyon-${payload.k}-${S.todayISO()}.png`;

  const toBlob = () => new Promise(res => canvas.toBlob(res, 'image/png'));
  const actions = el('div', { class: 'row tight qr-actions' }, [
    el('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
      const blob = await toBlob();
      const a = el('a', { href: URL.createObjectURL(blob), download: fileName });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      toast(t('qr.qr_image_saved'), 'good');
    } }, [icon('fa-download'), el('span', { text: t('qr.save_image') })]),
    navigator.share ? el('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
      try {
        const blob = await toBlob();
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: label, text: url });
        else await navigator.share({ title: label, url });
      } catch { /* user cancelled */ }
    } }, [icon('fa-share-nodes'), el('span', { text: t('flows.share') })]) : null,
    el('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
      await copyText(url); toast(t('remind.copied'), 'good');
    } }, [icon('fa-link'), el('span', { text: t('qr.copy_link') })])
  ]);

  sheet({
    title: t('qr.show_as_qr_code'),
    body: el('div', { class: 'stack' }, [
      el('div', { class: 'qr-card' }, [
        el('div', { class: 'qr-kind' }, [icon((KIND_LABEL[payload.k] || {}).icon || 'fa-qrcode'), el('span', { text: ' ' + kindLabel(payload.k) })]),
        canvas,
        el('b', { class: 'qr-summary', text: summaryLine(payload) }),
        payload.nd ? el('small', { text: t('qr.proposed_date', { date: formatDate(payload.nd) }) }) : null
      ]),
      el('p', { class: 'hint', style: { textAlign: 'center' }, text: t('qr.let_other_person_scan') }),
      actions,
      el('p', { class: 'notice', text: t('qr.details_travel_inside_code') })
    ]),
    footer: [el('button', { class: 'btn btn-primary', type: 'button', text: t('action.close'), onclick: () => closeSheet() })]
  });
}

/* A small reusable button for any request sheet. `getPayload` returns the
   payload, or null if the form isn't valid yet (it should show its own errors). */
export function qrButton(getPayload, opts = {}) {
  return el('button', { class: 'btn ' + (opts.cls || 'btn-sm'), type: 'button', 'data-qr': '1',
    onclick: () => { const p = getPayload(); if (p) openRequestQR(p); } },
    [icon('fa-qrcode'), el('span', { text: t('flows.qr_code') })]);
}

/* ---------------- scanned request view  #/r?d=… ---------------- */
export function renderRequest(params, { onAdd } = {}) {
  const p = decodePayload(params.get('d'));
  const wrap = el('div', { class: 'stack fade-in', style: { maxWidth: '560px', margin: '0 auto' } });
  if (!p) {
    wrap.append(el('section', { class: 'card' }, [
      el('h1', { text: t('qr.code_could_not_be') }),
      el('p', { text: t('qr.may_be_incomplete_or') }),
      el('a', { class: 'btn btn-primary', href: '#/' }, [icon('fa-house'), el('span', { text: t('qr.open_dyon') })])
    ]));
    return wrap;
  }
  /* From the sender's view "I owe" means the scanner is owed — mirror it. */
  const mine = p.r === 'I_OWE' ? 'OWED_TO_ME' : p.r === 'OWED_TO_ME' ? 'I_OWE' : 'MUTUAL';
  const dl = el('dl', { class: 'kv' });
  const kv = (k, v) => { if (v) dl.append(el('dt', { text: k }), el('dd', { text: v })); };
  kv(t('qr.from'), t('qr.from_name', { name: p.f || t('qr.someone'), unverified: p.pv ? 'yes' : 'no' }));
  kv(t('qr.for'), t(mine === 'I_OWE' ? 'dir.i_owe' : mine === 'OWED_TO_ME' ? 'dir.owed_to_me' : 'dir.mutual'));
  if (p.a) kv(t('add.amount'), formatAmount(p.a, p.u));
  kv(t('add.description'), p.d);
  if (p.i) kv(t('add.incurred'), formatDate(p.i));
  if (p.du) kv(t('add.due'), formatDate(p.du));
  if (p.nd) kv(t('qr.proposed_date_2'), formatDate(p.nd));
  kv(t('qr.note'), p.m);

  wrap.append(
    el('section', { class: 'card card-hero' }, [
      el('div', { class: 'row tight' }, [el('span', { class: 'qr-hero-mark' }, [icon((KIND_LABEL[p.k] || {}).icon || 'fa-qrcode')]),
        el('h1', { text: kindLabel(p.k), style: { margin: '0' } })]),
      el('p', { style: { margin: '8px 0 0' }, text: t('qr.scanned_from_dyon_request') })
    ]),
    el('section', { class: 'card' }, [dl]),
    el('div', { class: 'row tight' }, [
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => onAdd && onAdd({
        direction: mine, counterparty_name: p.f || '', unit_code: p.u,
        amount: p.a && isMonetary(p.u) ? p.a : p.a, description: p.d || '', incurred_on: p.i, due_on: p.nd || p.du
      }) }, [icon('fa-plus'), el('span', { text: t('qr.add_my_ledger') })]),
      el('a', { class: 'btn', href: '#/' }, [el('span', { text: t('auth.not_now') })])
    ]),
    el('p', { class: 'notice', text: t('qr.nothing_was_saved_yet') })
  );
  return wrap;
}
