/* DYON — §3 country detection and country-based defaults.

   Detection order (no third-party calls from the browser):
     (a) GET /api/geo.php → {country:'TN'}  (same-origin; CF-IPCountry or a local
         GeoLite2 lookup server-side; skipped silently on 404/offline/dev)
     (b) Intl.DateTimeFormat().resolvedOptions().timeZone → TZ_COUNTRY
     (c) region subtag of navigator.language (fr-TN → TN)

   applyCountry() only re-applies defaults when the user explicitly said yes, and
   NEVER turns on Islamic mode (it may only surface the suggestion text). The
   locale is only changed when the user has not chosen one yet (!locale_chosen). */

import { TZ_COUNTRY } from './tz-country.js';

let _cache = null;             // assets/countries.json, loaded once

function assetBase() {
  try { return new URL('../assets/', import.meta.url).href; } catch { return 'assets/'; }
}

/* All country records (client copy). Admin overrides live server-side (§4/§10). */
export async function loadCountries() {
  if (_cache) return _cache;
  try {
    const res = await fetch(assetBase() + 'countries.json', { cache: 'force-cache' });
    if (!res.ok) throw new Error('countries ' + res.status);
    const json = await res.json();
    _cache = json.countries || {};
  } catch {
    _cache = {};
  }
  return _cache;
}

export async function countryDefaults(cc) {
  if (!cc) return null;
  const all = await loadCountries();
  return all[String(cc).toUpperCase()] || null;
}

/* region subtag of a BCP-47 tag: fr-TN → TN, en-US → US, ar → null */
export function regionOfTag(tag) {
  if (!tag) return null;
  const parts = String(tag).split('-');
  for (const p of parts.slice(1)) {
    if (/^[A-Za-z]{2}$/.test(p)) return p.toUpperCase();
    if (/^\d{3}$/.test(p)) return null;   // UN M49 region, not ISO-3166 alpha-2
  }
  return null;
}

export function countryFromTimezone(tz) {
  if (!tz) return null;
  return TZ_COUNTRY[tz] || null;
}

/* Returns { country, source } or { country:null, source:'none' }.
   `fetchImpl`, `timeZone`, `languages` are injectable for tests. */
export async function detectCountry(opts = {}) {
  const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  // (a) same-origin server hint
  if (fetchImpl) {
    try {
      const res = await fetchImpl('/api/geo.php', { headers: { Accept: 'application/json' } });
      if (res && res.ok) {
        const j = await res.json();
        if (j && typeof j.country === 'string' && /^[A-Za-z]{2}$/.test(j.country)) {
          return { country: j.country.toUpperCase(), source: 'server' };
        }
      }
    } catch { /* offline / 404 in dev — fall through silently */ }
  }
  // (b) timezone
  let tz = opts.timeZone;
  if (tz === undefined) {
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { tz = null; }
  }
  const byTz = countryFromTimezone(tz);
  if (byTz) return { country: byTz, source: 'timezone' };
  // (c) language region subtag
  const langs = opts.languages || (typeof navigator !== 'undefined' ? navigator.languages : []) || [];
  for (const tag of langs) {
    const r = regionOfTag(tag);
    if (r) return { country: r, source: 'language' };
  }
  return { country: null, source: 'none' };
}

/* Apply a country's defaults to settings.
   `apply` gates the opinionated defaults (currency/digits/calendar/week start);
   when false we only record `country` so Region shows the right selection.
   The locale is applied only if the user has not chosen one (§2.4).
   NEVER sets islamic_mode — only the suggestion text may reference it. */
export async function applyCountry(cc, { apply = false, store } = {}) {
  const S = store;
  if (!S) throw new Error('applyCountry needs the store');
  const code = String(cc || '').toUpperCase();
  const def = await countryDefaults(code);
  const patch = { country: code };

  if (apply && def) {
    patch.base_currency = def.currency;
    patch.digits = def.digits;
    patch.calendar_primary = def.calendar_primary;
    patch.calendar_secondary = def.calendar_secondary || 'none';
    patch.week_start = def.week_start;
    // locale only if the user hasn't explicitly chosen one
    if (!S.state.settings.locale_chosen && Array.isArray(def.locales)) {
      const avail = def.locales.find(l => l === 'en' || l === 'ar' || l === 'fr');
      if (avail) patch.locale = avail;
    }
    // islamic_mode is deliberately NOT set here (suggestion only, §3.2)
  }
  await S.saveSettings(patch);
  return { def, patch };
}

/* Locales a country prefers, for feeding firstRunLocale() (§2.4 country step). */
export async function countryLocales(cc) {
  const def = await countryDefaults(cc);
  return def && Array.isArray(def.locales) ? def.locales : [];
}
