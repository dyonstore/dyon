/* DYON — Units (§6.2, §6.3, §6.4).
   R-M01: money is ALWAYS integer minor units + unit code. No floats in money paths.
   R-G03: minor digits come from ISO data, never hard-coded per-feature.
   RL-01: there is no interest, rate, penalty or late-fee concept anywhere here. */

import { t, formatNumber, mapDigits, getLocale, tr, decimalSeparator } from './i18n.js';

/* ISO 4217 subset covering 0, 2 and 3 minor-digit cases + widely used currencies.
   Any other ISO code can be added by the user via custom units. */
export const CURRENCIES = {
  USD: { d: 2, en: 'US Dollar', ar: 'دولار أمريكي', sym: '$' },
  EUR: { d: 2, en: 'Euro', ar: 'يورو', sym: '€' },
  GBP: { d: 2, en: 'Pound Sterling', ar: 'جنيه إسترليني', sym: '£' },
  SAR: { d: 2, en: 'Saudi Riyal', ar: 'ريال سعودي', sym: 'ر.س' },
  AED: { d: 2, en: 'UAE Dirham', ar: 'درهم إماراتي', sym: 'د.إ' },
  QAR: { d: 2, en: 'Qatari Riyal', ar: 'ريال قطري', sym: 'ر.ق' },
  OMR: { d: 3, en: 'Omani Rial', ar: 'ريال عُماني', sym: 'ر.ع' },
  KWD: { d: 3, en: 'Kuwaiti Dinar', ar: 'دينار كويتي', sym: 'د.ك' },
  BHD: { d: 3, en: 'Bahraini Dinar', ar: 'دينار بحريني', sym: 'د.ب' },
  JOD: { d: 3, en: 'Jordanian Dinar', ar: 'دينار أردني', sym: 'د.أ' },
  EGP: { d: 2, en: 'Egyptian Pound', ar: 'جنيه مصري', sym: 'ج.م' },
  MAD: { d: 2, en: 'Moroccan Dirham', ar: 'درهم مغربي', sym: 'د.م' },
  DZD: { d: 2, en: 'Algerian Dinar', ar: 'دينار جزائري', sym: 'د.ج' },
  TND: { d: 3, en: 'Tunisian Dinar', ar: 'دينار تونسي', sym: 'د.ت' },
  TRY: { d: 2, en: 'Turkish Lira', ar: 'ليرة تركية', sym: '₺' },
  PKR: { d: 2, en: 'Pakistani Rupee', ar: 'روبية باكستانية', sym: '₨' },
  INR: { d: 2, en: 'Indian Rupee', ar: 'روبية هندية', sym: '₹' },
  BDT: { d: 2, en: 'Bangladeshi Taka', ar: 'تاكا بنغلاديشية', sym: '৳' },
  IDR: { d: 2, en: 'Indonesian Rupiah', ar: 'روبية إندونيسية', sym: 'Rp' },
  MYR: { d: 2, en: 'Malaysian Ringgit', ar: 'رينغيت ماليزي', sym: 'RM' },
  NGN: { d: 2, en: 'Nigerian Naira', ar: 'نايرا نيجيرية', sym: '₦' },
  JPY: { d: 0, en: 'Japanese Yen', ar: 'ين ياباني', sym: '¥' },
  KRW: { d: 0, en: 'South Korean Won', ar: 'وون كوري', sym: '₩' },
  CAD: { d: 2, en: 'Canadian Dollar', ar: 'دولار كندي', sym: 'C$' },
  AUD: { d: 2, en: 'Australian Dollar', ar: 'دولار أسترالي', sym: 'A$' },
  CHF: { d: 2, en: 'Swiss Franc', ar: 'فرنك سويسري', sym: 'Fr' },
  SEK: { d: 2, en: 'Swedish Krona', ar: 'كرونة سويدية', sym: 'kr' },
  ZAR: { d: 2, en: 'South African Rand', ar: 'راند جنوب أفريقي', sym: 'R' },
  YER: { d: 2, en: 'Yemeni Rial', ar: 'ريال يمني', sym: 'ر.ي' },
  IQD: { d: 3, en: 'Iraqi Dinar', ar: 'دينار عراقي', sym: 'د.ع' },
  SDG: { d: 2, en: 'Sudanese Pound', ar: 'جنيه سوداني', sym: 'ج.س' },
  SYP: { d: 2, en: 'Syrian Pound', ar: 'ليرة سورية', sym: 'ل.س' },
  LBP: { d: 2, en: 'Lebanese Pound', ar: 'ليرة لبنانية', sym: 'ل.ل' },
  IRR: { d: 2, en: 'Iranian Rial', ar: 'ريال إيراني', sym: '﷼' }
};

/* Metals (grams with purity) and non-monetary units (§6.4) */
export const SPECIAL_UNITS = {
  XAU_G24: { d: 3, en: 'Gold 24k (grams)', ar: 'ذهب ٢٤ (غرام)', kind: 'metal' },
  XAU_G21: { d: 3, en: 'Gold 21k (grams)', ar: 'ذهب ٢١ (غرام)', kind: 'metal' },
  XAU_G18: { d: 3, en: 'Gold 18k (grams)', ar: 'ذهب ١٨ (غرام)', kind: 'metal' },
  XAG_G:   { d: 3, en: 'Silver (grams)', ar: 'فضة (غرام)', kind: 'metal' },
  HOUR:    { d: 2, en: 'Hours', ar: 'ساعات', kind: 'time' },
  DAY:     { d: 0, en: 'Days', ar: 'أيام', kind: 'time' },
  SHIFT:   { d: 0, en: 'Shifts', ar: 'ورديات', kind: 'time' },
  ITEM:    { d: 0, en: 'Items', ar: 'قطع', kind: 'item' },
  TASK:    { d: 0, en: 'Tasks', ar: 'مهام', kind: 'task' },
  OCCASION:{ d: 0, en: 'Occasions', ar: 'مناسبات', kind: 'occasion' },
  PROMISE: { d: 0, en: 'Promise (done / not done)', ar: 'وعد (تم / لم يتم)', kind: 'custom' },
  FASTDAY: { d: 0, en: 'Fast days', ar: 'أيام صيام', kind: 'spiritual' },
  PRAYER:  { d: 0, en: 'Prayers', ar: 'صلوات', kind: 'spiritual' }
};

export function unitInfo(code) {
  if (CURRENCIES[code]) return Object.assign({ kind: 'currency', code }, CURRENCIES[code]);
  if (SPECIAL_UNITS[code]) return Object.assign({ code }, SPECIAL_UNITS[code]);
  return { code, d: 2, kind: 'custom', en: code, ar: code };
}
export function unitLabel(code) {
  const u = unitInfo(code);
  return tr({ en: u.en || u.code, ar: u.ar || u.code, fr: u.fr || u.en || u.code });
}
export function unitShort(code) {
  const u = unitInfo(code);
  if (u.kind === 'currency') return code;
  return unitLabel(code);
}
export function minorDigits(code) { return unitInfo(code).d; }

/* Turns what a person typed into a plain "1234.56" string (or '' when it is
   not a number). Accepts Western, Arabic-Indic and Persian digits, spaces /
   NBSP / U+202F / ٬ as grouping, and ٫ . , as the decimal mark. When both
   . and , appear, the LAST one is the decimal mark ("1,250.00", "1.250,00");
   when only , appears it is a decimal mark in comma-decimal locales (fr) and
   a grouping mark otherwise. */
export function normalizeDecimal(input) {
  let s = String(input ?? '').trim()
    .replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c))
    .replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c))
    .replace(/[\s\u00A0\u202F\u066C']/g, '')
    .replace(/\u066B/g, '.')
    .replace(/^[−–]/, '-');
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const dec = lastDot > lastComma ? '.' : ',';
    const grp = dec === '.' ? ',' : '.';
    s = s.split(grp).join('').replace(dec, '.');
  } else if (lastComma !== -1) {
    const commaDecimal = decimalSeparator() === ',';
    const parts = s.split(',');
    const looksGrouped = parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && !commaDecimal);
    s = looksGrouped ? parts.join('') : parts.join('.');
  }
  return /^-?\d*(?:\.\d*)?$/.test(s) ? s : '';
}

/* Parse a user-typed decimal into integer minor units (no float storage) */
export function toMinor(input, code) {
  const d = minorDigits(code);
  const s = normalizeDecimal(input);
  if (!s || s === '-' || s === '.') return 0;
  const neg = s.startsWith('-');
  const clean = s.replace(/^-/, '');
  const [intPart, fracRaw = ''] = clean.split('.');
  const frac = (fracRaw + '0'.repeat(d)).slice(0, d);
  const minor = BigInt(intPart || '0') * BigInt(10 ** d) + BigInt(frac || '0');
  return Number(neg ? -minor : minor);
}

/* Render integer minor units back to a localized string */
export function fromMinor(minor, code) {
  const d = minorDigits(code);
  const neg = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 10 ** d);
  const frac = abs % 10 ** d;
  let s = formatNumber(whole);
  if (d > 0) {
    const sep = decimalSeparator();
    s += sep + mapDigits(String(frac).padStart(d, '0'));
  }
  return (neg ? '−' : '') + s;
}

/* Value for an editable amount field: no grouping, locale decimal mark,
   user digits — so what we prefill is always accepted back by toMinor. */
export function inputValue(minor, code) {
  if (!minor) return '';
  const d = minorDigits(code);
  const abs = Math.abs(Math.round(minor));
  const whole = mapDigits(String(Math.floor(abs / 10 ** d)));
  const frac = d ? decimalSeparator() + mapDigits(String(abs % 10 ** d).padStart(d, '0')) : '';
  return (minor < 0 ? '-' : '') + whole + frac;
}

/* Full display: amount + unit, bidi-safe */
export function formatAmount(minor, code, opts = {}) {
  const u = unitInfo(code);
  const num = fromMinor(minor, code);
  if (u.kind === 'currency') {
    const label = opts.symbol && u.sym ? u.sym : code;
    return t('amount.currency', { amount: num, unit: label });
  }
  return t('amount.unit', { amount: num, unit: unitLabel(code) });
}

/* Screen-reader friendly amount (§7.15) */
export function speakAmount(minor, code) {
  const u = unitInfo(code);
  return t('amount.unit', { amount: fromMinor(minor, code), unit: unitLabel(code) });
}

/* Banker's rounding (half-even) — display conversions only (§6.3) */
export function bankersRound(x) {
  const f = Math.floor(x);
  const diff = x - f;
  if (Math.abs(diff - 0.5) > Number.EPSILON) return Math.round(x);
  return f % 2 === 0 ? f : f + 1;
}

/* Indicative FX table — DISPLAY ONLY (§6.3 rule 2). Never revalues an obligation.
   Values are rough, dated references the user can edit in Settings. */
export const FX_SOURCE = { source: 'DYON indicative table (editable)', as_of: '2026-10-01' };
export const FX_USD = {
  USD: 1, EUR: 0.92, GBP: 0.79, SAR: 3.75, AED: 3.6725, QAR: 3.64, OMR: 0.3845,
  KWD: 0.3065, BHD: 0.376, JOD: 0.709, EGP: 48.2, MAD: 9.85, DZD: 133.5, TND: 3.1,
  TRY: 34.2, PKR: 278, INR: 83.9, BDT: 119, IDR: 15600, MYR: 4.3, NGN: 1580,
  JPY: 150, KRW: 1340, CAD: 1.37, AUD: 1.5, CHF: 0.86, SEK: 10.5, ZAR: 17.8,
  YER: 250, IQD: 1310, SDG: 600, SYP: 13000, LBP: 89500, IRR: 42000,
  XAU_G24: 0.0122, XAU_G21: 0.0139, XAU_G18: 0.0163, XAG_G: 1.02
};

export function convertMinor(minor, from, to) {
  if (from === to) return minor;
  const rf = FX_USD[from], rt = FX_USD[to];
  if (!rf || !rt) return null;
  const major = minor / 10 ** minorDigits(from);
  const converted = (major / rf) * rt;
  return bankersRound(converted * 10 ** minorDigits(to));
}
export function fxRate(from, to) {
  const rf = FX_USD[from], rt = FX_USD[to];
  if (!rf || !rt) return null;
  return rt / rf;
}
export function fxNotice(from, to) {
  const r = fxRate(from, to);
  if (r === null) return '';
  return t('fx.display_only', {
    rate: formatNumber(r, { maximumFractionDigits: 4 }),
    date: FX_SOURCE.as_of,
    unit: unitShort(from)
  });
}

export function isMonetary(code) { const k = unitInfo(code).kind; return k === 'currency' || k === 'metal'; }
export function isCurrency(code) { return unitInfo(code).kind === 'currency'; }

export function unitOptions() {
  const cur = Object.keys(CURRENCIES).map(c => ({ code: c, group: 'currency', label: `${c} — ${unitLabel(c)}` }));
  const sp = Object.keys(SPECIAL_UNITS).map(c => ({ code: c, group: SPECIAL_UNITS[c].kind, label: unitLabel(c) }));
  return { currencies: cur, special: sp };
}

/* Guess a currency from a locale/region hint, used only as a suggestion */
export function guessCurrency() {
  const map = { SA: 'SAR', AE: 'AED', EG: 'EGP', MA: 'MAD', DZ: 'DZD', TN: 'TND', QA: 'QAR',
    KW: 'KWD', BH: 'BHD', OM: 'OMR', JO: 'JOD', TR: 'TRY', PK: 'PKR', IN: 'INR', BD: 'BDT',
    ID: 'IDR', MY: 'MYR', NG: 'NGN', GB: 'GBP', US: 'USD', CA: 'CAD', AU: 'AUD', CH: 'CHF',
    FR: 'EUR', DE: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', IT: 'EUR' };
  try {
    const region = new Intl.Locale(navigator.language).region;
    return map[region] || 'USD';
  } catch { return 'USD'; }
}
