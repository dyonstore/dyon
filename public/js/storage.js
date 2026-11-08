/* DYON §6.5 — what the browser says about storage on this device. Pure helpers (no DOM) so the app card and the /storage page share them. */

/** @param {StorageManager|undefined} sm  injectable for tests */
export async function info(sm = (typeof navigator !== 'undefined' ? navigator.storage : undefined)) {
  const out = { supported: !!(sm && sm.estimate), usage: null, quota: null, persisted: null, canPersist: !!(sm && sm.persist) };
  if (!sm) return out;
  try { if (sm.estimate) { const e = await sm.estimate(); out.usage = e.usage ?? null; out.quota = e.quota ?? null; } } catch { out.supported = false; }
  try { if (sm.persisted) out.persisted = !!(await sm.persisted()); } catch { /* unknown */ }
  return out;
}

/** Asks the browser to keep the data. Returns 'granted' | 'declined' | 'error' | 'unsupported'. Never throws. */
export async function keep(sm = (typeof navigator !== 'undefined' ? navigator.storage : undefined)) {
  if (!sm || !sm.persist) return 'unsupported';
  try { return (await sm.persist()) ? 'granted' : 'declined'; } catch { return 'error'; }
}

/** Human-readable size. `fmt(number, Intl options)` supplies the locale/digits. */
export function formatBytes(n, fmt) {
  if (n == null || !isFinite(n)) return '';
  const U = [['byte', 1], ['kilobyte', 1024], ['megabyte', 1024 ** 2], ['gigabyte', 1024 ** 3], ['terabyte', 1024 ** 4]];
  let i = 0; while (i < U.length - 1 && n >= U[i + 1][1]) i++;
  const v = n / U[i][1];
  return fmt(v, { style: 'unit', unit: U[i][0], unitDisplay: 'short', maximumFractionDigits: i === 0 ? 0 : v < 10 ? 1 : 0 });
}

/** The calm status key for what the browser reported. */
export const statusKey = (i) => !i.supported ? 'storage.st_unsupported' : i.persisted ? 'storage.st_persistent' : 'storage.st_best_effort';
