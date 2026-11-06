/* DYON — i18n (§6). Locale files, ICU messages, RTL, digits and calendars.

   - Strings live in /locales/{code}.json (one flat object per locale) and are
     fetched lazily; the service worker caches them. English is always loaded
     too: the fallback chain is requested → en.
   - Messages are an ICU MessageFormat subset: {var}, {n, plural, =0 {…} one {…}
     other {…}} with `#`, {x, select, a {…} other {…}}, nested freely. Plural
     categories come from Intl.PluralRules for the active locale (Arabic has
     all six). R-G01: no string concatenation for user-visible sentences.
   - Numbers and dates go through Intl with the locale's own conventions; the
     user's digit preference (latn / arab / extarab) is applied on top. */

export const LOCALES = {
  en: { name: 'English', native: 'English', dir: 'ltr', intl: 'en-GB', phase: 'MVP' },
  ar: { name: 'Arabic', native: 'العربية', dir: 'rtl', intl: 'ar', phase: 'MVP' },
  fr: { name: 'French', native: 'Français', dir: 'ltr', intl: 'fr-FR', phase: '2' }
};
/* Ready to switch on once their locale files are reviewed by native speakers
   (RL-12). Listing them here makes detection and the picker aware of them. */
export const PLANNED_LOCALES = {
  es: { name: 'Spanish', native: 'Español', dir: 'ltr', intl: 'es' },
  tr: { name: 'Turkish', native: 'Türkçe', dir: 'ltr', intl: 'tr' },
  de: { name: 'German', native: 'Deutsch', dir: 'ltr', intl: 'de' },
  id: { name: 'Indonesian', native: 'Bahasa Indonesia', dir: 'ltr', intl: 'id' },
  ur: { name: 'Urdu', native: 'اردو', dir: 'rtl', intl: 'ur' }
};
export const FALLBACK = 'en';

const DICT = {};                 // code -> { key: message }
let current = 'en';
let digitsPref = 'latn';
let calPrimary = 'gregory';
let calSecondary = 'none';
let localeBase = '';             // URL prefix for /locales (set by the page)

/* ---------- loading ---------- */
export function setLocaleBase(prefix) { localeBase = prefix || ''; }
function defaultBase() {
  if (localeBase) return localeBase;
  try { return new URL('../locales/', import.meta.url).href; } catch { return 'locales/'; }
}
const inflight = {};
export function loadLocale(code) {
  if (!LOCALES[code]) code = FALLBACK;
  if (DICT[code]) return Promise.resolve(DICT[code]);
  if (inflight[code]) return inflight[code];
  inflight[code] = fetch(defaultBase() + code + '.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error('locale ' + code + ' ' + r.status); return r.json(); })
    .then(json => { DICT[code] = json; return json; })
    .finally(() => { delete inflight[code]; });
  return inflight[code];
}
/* Loads the requested locale and the English fallback. Never throws: a
   missing locale file degrades to English instead of a blank app. */
export async function ensureLocale(code) {
  await loadLocale(FALLBACK).catch(() => { DICT[FALLBACK] = DICT[FALLBACK] || {}; });
  if (code && code !== FALLBACK) await loadLocale(code).catch(() => {});
}
/* For tests and server-side rendering of the same files. */
export function registerMessages(code, json) { DICT[code] = Object.assign(DICT[code] || {}, json); }
export function messages(code) { return DICT[code] || {}; }
export function isLoaded(code) { return !!DICT[code]; }

/* ---------- state ---------- */
export function setLocale(l) { current = LOCALES[l] ? l : FALLBACK; }
export function getLocale() { return current; }
export function getDir() { return LOCALES[current].dir; }
export function intlTag(l = current) { return (LOCALES[l] || PLANNED_LOCALES[l] || LOCALES.en).intl; }
export function setDigits(d) { digitsPref = d || 'latn'; }
export function getDigits() { return digitsPref; }
export function setCalendars(primary, secondary) {
  calPrimary = primary || 'gregory';
  calSecondary = secondary || 'none';
}
export function getCalendars() { return { primary: calPrimary, secondary: calSecondary }; }

/* ---------- lookup ---------- */
export function has(key, l) {
  if (l) return DICT[l] && Object.prototype.hasOwnProperty.call(DICT[l], key);
  return !!((DICT[current] && key in DICT[current]) || (DICT[FALLBACK] && key in DICT[FALLBACK]));
}
export function raw(key, l = current) {
  const d = DICT[l];
  if (d && key in d) return d[key];
  const f = DICT[FALLBACK];
  if (f && key in f) return f[key];
  return null;
}

/* Data objects carrying their own translations ({ en, ar, fr }). */
export function tr(obj, l = current) {
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return obj;
  return obj[l] ?? obj[FALLBACK] ?? obj.ar ?? Object.values(obj).find(v => typeof v === 'string') ?? '';
}

/* ---------- ICU subset ---------- */
const pluralRulesCache = {};
function pluralCat(l, n) {
  const tag = intlTag(l);
  const pr = pluralRulesCache[tag] || (pluralRulesCache[tag] = new Intl.PluralRules(tag));
  return pr.select(n);
}

/* Parses "key {…} key {…}" branches of a plural/select body. */
function branches(body) {
  const out = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    let key = '';
    while (i < body.length && body[i] !== '{') { key += body[i]; i++; }
    key = key.trim();
    if (body[i] !== '{') break;
    let depth = 0, val = '';
    for (; i < body.length; i++) {
      const ch = body[i];
      if (ch === '{') { depth++; if (depth === 1) continue; }
      if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
      val += ch;
    }
    out[key] = val;
  }
  return out;
}

export function format(msg, vars = {}, l = current, hash) {
  let out = '';
  let i = 0;
  while (i < msg.length) {
    const ch = msg[i];
    if (ch === "'" && msg[i + 1] === "'") { out += "'"; i += 2; continue; }
    if (ch === '#' && hash !== undefined) { out += hash; i++; continue; }
    if (ch !== '{') { out += ch; i++; continue; }
    let depth = 0, inner = '';
    for (; i < msg.length; i++) {
      const c = msg[i];
      if (c === '{') { depth++; if (depth === 1) continue; }
      if (c === '}') { depth--; if (depth === 0) { i++; break; } }
      inner += c;
    }
    const m = inner.match(/^\s*(\w+)\s*,\s*(plural|select|selectordinal)\s*,([\s\S]*)$/);
    if (m) {
      const [, name, type, body] = m;
      const b = branches(body);
      const v = vars[name];
      let chosen;
      if (type === 'select') chosen = b[String(v)] ?? b.other ?? '';
      else {
        const n = Number(v ?? 0);
        chosen = b['=' + n] ?? b[pluralCat(l, n)] ?? b.other ?? '';
        out += format(chosen, vars, l, formatNumber(n));
        continue;
      }
      out += format(chosen, vars, l, hash);
    } else {
      const name = inner.trim();
      out += vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : '{' + name + '}';
    }
  }
  return out;
}

export function t(key, vars, l = current) {
  const msg = raw(key, l);
  if (msg === null) return key;
  // Back-compat: plural keys written as {count, plural, …} receive `count`.
  return format(msg, vars || {}, l);
}

/* ---------- Numbers & digits ---------- */
const DIGIT_MAPS = {
  latn: '0123456789',
  arab: '٠١٢٣٤٥٦٧٨٩',
  extarab: '۰۱۲۳۴۵۶۷۸۹'
};
export function mapDigits(str) {
  if (digitsPref === 'latn') return String(str);
  const map = DIGIT_MAPS[digitsPref] || DIGIT_MAPS.latn;
  return String(str).replace(/[0-9]/g, d => map[+d]);
}
const nfCache = {};
export function formatNumber(n, opts) {
  const tag = intlTag() + '-u-nu-latn';
  const k = tag + JSON.stringify(opts || {});
  const nf = nfCache[k] || (nfCache[k] = new Intl.NumberFormat(tag, opts));
  return mapDigits(nf.format(n));
}
/* Decimal separator for the active locale (from Intl, never hard-coded). */
export function decimalSeparator() {
  if (current === 'ar') return '٫';
  const part = new Intl.NumberFormat(intlTag()).formatToParts(1.5).find(p => p.type === 'decimal');
  return part ? part.value : '.';
}

/* Bidi isolation for amounts inside RTL sentences */
export function isolate(s) { return '\u2068' + s + '\u2069'; }

/* ---------- Dates ---------- */
function toDate(iso) {
  return typeof iso === 'string' ? new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')) : new Date(iso);
}
function dateTag(cal) {
  const base = current === 'ar' ? 'ar-EG' : intlTag();
  return { base, loc: base + '-u-ca-' + cal + '-nu-latn' };
}
export function formatDate(iso, opts) {
  if (!iso) return t('misc.none');
  const d = toDate(iso);
  if (isNaN(d)) return String(iso);
  const o = Object.assign({ year: 'numeric', month: 'short', day: 'numeric' }, opts || {});
  const { base, loc } = dateTag(calPrimary);
  let out;
  try { out = new Intl.DateTimeFormat(loc, o).format(d); }
  catch { out = new Intl.DateTimeFormat(base, o).format(d); }
  return mapDigits(out);
}
export function formatDateDual(iso, opts) {
  const main = formatDate(iso, opts);
  if (calSecondary === 'none' || !iso) return main;
  const d = toDate(iso);
  const { loc } = dateTag(calSecondary);
  let sec = '';
  try {
    sec = new Intl.DateTimeFormat(loc, Object.assign({ year: 'numeric', month: 'short', day: 'numeric' }, opts || {})).format(d);
  } catch { return main; }
  return t('date.dual', { main, secondary: mapDigits(sec) });
}
export function formatDateTime(ms) {
  const d = new Date(ms);
  const base = current === 'ar' ? 'ar-EG' : intlTag();
  return mapDigits(new Intl.DateTimeFormat(base + '-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(d));
}
export function weekdayShort(date) {
  const base = current === 'ar' ? 'ar-EG' : intlTag();
  return new Intl.DateTimeFormat(base, { weekday: 'short' }).format(date);
}
export function relativeDays(n) {
  if (n === 0) return t('time.due_today');
  if (n < 0) return t('time.overdue_by', { count: Math.abs(n) });
  return t('time.due_in', { count: n });
}

/* ---------- Detection (v2.0 §2.4) ----------
   saved setting → ?lang= → navigator.languages (first supported base tag)
   → country default → en. `source` says why, for "Detected: … (from your
   browser)". Never called again once the user has chosen. */
export function detectLocale({ saved, search, languages, countryLocales } = {}) {
  const ok = (c) => c && LOCALES[c];
  if (ok(saved)) return { locale: saved, source: 'saved' };
  try {
    const q = new URLSearchParams(search || '').get('lang');
    if (q && ok(q.toLowerCase().split('-')[0])) return { locale: q.toLowerCase().split('-')[0], source: 'url' };
  } catch {}
  for (const tag of languages || []) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (ok(base)) return { locale: base, source: 'browser' };
  }
  for (const c of countryLocales || []) if (ok(c)) return { locale: c, source: 'country' };
  return { locale: FALLBACK, source: 'default' };
}
