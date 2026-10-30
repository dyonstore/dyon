/* DYON — form validation.
   Principles from §7.15 (cognitive accessibility) and RL-05 (no dark patterns):
   - errors are stated in plain language, never only in colour;
   - every message says what to do, not what you did wrong;
   - nothing blocks the user silently: the submit button stays live and
     explains, instead of being mysteriously disabled;
   - validation runs on blur and on submit, never on every keystroke (which
     punishes people mid-typing). */

import { t, getLocale, formatNumber } from './i18n.js';
import { toMinor, minorDigits, unitShort, isMonetary, normalizeDecimal } from './units.js';
import { el, icon } from './ui.js';


export const MSG = {
  required: () => t('validate.field_needed'),
  whoRequired: () => t('validate.add_other_party_s'),
  amountRequired: () => t('validate.enter_amount_greater_than'),
  amountNumber: () => t('validate.use_digits_only_e'),
  amountTooBig: () => t('validate.that_amount_unusually_large'),
  tooManyDecimals: (n, u) => t('validate.allows_at_most_decimal', { u: unitShort(u), n: formatNumber(n) }),
  dateInvalid: () => t('validate.that_date_isn_t'),
  dateFuture: () => t('validate.date_incurred_cannot_be'),
  dueBeforeIncurred: () => t('validate.due_date_before_date'),
  datePast: () => t('validate.that_date_has_passed'),
  installments: () => t('validate.use_between_2_60'),
  installmentsNeedAmount: () => t('validate.installments_need_amount_first'),
  installmentsNeedDate: () => t('validate.installments_need_first_due'),
  overRemaining: (txt) => t('validate.more_than_remaining_record', { txt }),
  pinLength: () => t('validate.use_at_least_4'),
  pinDigits: () => t('validate.digits_only'),
  pinMismatch: () => t('validate.two_pins_don_t'),
  textTooLong: (n) => t('validate.characters_maximum', { n: formatNumber(n) }),
  pickOne: () => t('validate.please_choose_option'),
  consentAll: () => t('validate.transfer_needs_all_three'),
  capacityRequired: () => t('validate.enter_at_least_one'),
  summaryTitle: (n) => t('validate.field_need_attention', { count: n }),
  fileTooBig: (mb) => t('validate.file_larger_than_mb', { mb: formatNumber(mb) }),
  fileType: () => t('validate.that_file_type_isn')
};

/* ---------- numeric helpers ---------- */

export function normalizeNumeric(v) { return normalizeDecimal(v); }

export function decimalsOf(v) {
  const s = normalizeNumeric(v);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

/* ---------- Validator ----------
   Usage:
     const v = new Validator();
     v.rule(amountInput, () => amountRules(...));
     ...
     if (!v.check()) return;   // focuses + reports the first problem
*/
export class Validator {
  constructor(summaryNode) {
    this.rules = [];
    this.summary = summaryNode || el('div', { class: 'form-summary', role: 'alert', 'aria-live': 'polite' });
  }

  /* control: an input/select/textarea (or any node with .focus)
     fn: () => string|null  — returns an error message or null when valid */
  rule(control, fn, opts = {}) {
    const errNode = el('div', { class: 'err', id: (control.id || '') + '-err' });
    if (opts.appendTo) opts.appendTo.appendChild(errNode);
    else if (control.parentNode) control.parentNode.appendChild(errNode);
    const entry = { control, fn, errNode, label: opts.label || '' };
    this.rules.push(entry);
    control.addEventListener('blur', () => this.checkOne(entry));
    control.addEventListener('change', () => this.checkOne(entry));
    control.addEventListener('input', () => {
      // Clear a shown error as soon as the person starts fixing it.
      if (errNode.firstChild) this.checkOne(entry);
    });
    return errNode;
  }

  checkOne(entry) {
    const msg = entry.fn();
    entry.errNode.replaceChildren();
    if (msg) {
      entry.control.setAttribute('aria-invalid', 'true');
      entry.control.setAttribute('aria-describedby', entry.errNode.id);
      entry.errNode.append(icon('fa-circle-exclamation'), el('span', { text: msg }));
      return false;
    }
    entry.control.removeAttribute('aria-invalid');
    return true;
  }

  /* Validate everything. Returns true when the form is clean. */
  check() {
    const bad = [];
    for (const entry of this.rules) {
      if (!this.checkOne(entry)) bad.push(entry);
    }
    this.summary.replaceChildren();
    if (!bad.length) return true;
    this.summary.append(
      el('b', { text: MSG.summaryTitle(bad.length) }),
      el('ul', {}, bad.map(entry => el('li', {}, [
        el('button', {
          type: 'button', class: 'jump',
          text: (entry.label ? entry.label + ' — ' : '') + entry.fn(),
          onclick: () => { entry.control.focus(); entry.control.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        })
      ])))
    );
    const first = bad[0].control;
    first.focus();
    first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return false;
  }

  clear() {
    this.summary.replaceChildren();
    this.rules.forEach(r => { r.errNode.replaceChildren(); r.control.removeAttribute('aria-invalid'); });
  }
}

/* ---------- reusable rule builders ---------- */
export function requiredText(control, max = 400) {
  return () => {
    const v = (control.value || '').trim();
    if (!v) return MSG.required();
    if (v.length > max) return MSG.textTooLong(max);
    return null;
  };
}
export function optionalText(control, max = 2000) {
  return () => {
    const v = (control.value || '').trim();
    if (v.length > max) return MSG.textTooLong(max);
    return null;
  };
}
export function requiredWho(control) {
  return () => {
    const v = (control.value || '').trim();
    if (!v) return MSG.whoRequired();
    if (v.length > 80) return MSG.textTooLong(80);
    return null;
  };
}

/* amount: required > 0, digits only, respects the unit's minor digits */
export function amountRule(control, getUnit, opts = {}) {
  return () => {
    const raw = (control.value || '').trim();
    if (!raw) return opts.optional ? null : MSG.amountRequired();
    if (!normalizeDecimal(raw) || normalizeDecimal(raw).startsWith('-')) return MSG.amountNumber();
    const unit = getUnit();
    const d = minorDigits(unit);
    if (decimalsOf(raw) > d) return MSG.tooManyDecimals(d, unit);
    const minor = toMinor(raw, unit);
    if (!Number.isFinite(minor)) return MSG.amountNumber();
    if (minor <= 0 && !opts.allowZero) return MSG.amountRequired();
    if (minor > Number.MAX_SAFE_INTEGER / 1000) return MSG.amountTooBig();
    if (opts.max !== undefined) {
      const cap = opts.max();
      if (cap !== null && minor > cap) return MSG.overRemaining(opts.maxLabel ? opts.maxLabel() : formatNumber(cap));
    }
    return null;
  };
}

export function dateRule(control, opts = {}) {
  return () => {
    const v = control.value;
    if (!v) return opts.required ? MSG.required() : null;
    const d = new Date(v + 'T12:00:00');
    if (isNaN(d)) return MSG.dateInvalid();
    const today = new Date(); today.setHours(12, 0, 0, 0);
    if (opts.noFuture && d > today) return MSG.dateFuture();
    if (opts.future && d < today) return MSG.datePast();
    if (opts.notBefore) {
      const other = opts.notBefore();
      if (other) {
        const o = new Date(other + 'T12:00:00');
        if (!isNaN(o) && d < o) return MSG.dueBeforeIncurred();
      }
    }
    if (d.getFullYear() < 1900 || d.getFullYear() > 2200) return MSG.dateInvalid();
    return null;
  };
}

export function installmentsRule(control, hasAmount, getFirstDate) {
  return () => {
    const raw = normalizeNumeric(control.value);
    if (!raw || raw === '0') return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 2 || n > 60) return MSG.installments();
    if (!hasAmount()) return MSG.installmentsNeedAmount();
    if (!getFirstDate()) return MSG.installmentsNeedDate();
    return null;
  };
}

export function pinRule(control) {
  return () => {
    const v = (control.value || '').trim();
    if (!v) return MSG.required();
    if (!/^\d+$/.test(v)) return MSG.pinDigits();
    if (v.length < 4) return MSG.pinLength();
    return null;
  };
}

/* File checks used by the evidence vault */
export const MAX_FILE_MB = 4;
export function checkFile(file) {
  if (!file) return MSG.required();
  if (file.size > MAX_FILE_MB * 1024 * 1024) return MSG.fileTooBig(MAX_FILE_MB);
  const ok = /^(image\/|audio\/)/.test(file.type) || file.type === 'application/pdf' || file.type === '';
  if (!ok) return MSG.fileType();
  return null;
}

/* A small "* required" marker for labels */
export function reqMark() { return el('span', { class: 'req', text: ' *', 'aria-hidden': 'true' }); }
