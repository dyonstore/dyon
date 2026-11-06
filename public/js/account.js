/* DYON — server account state (v2.0 §5).
   The server (PHP, §4) is the only place a session can be verified. This module asks it who is signed in
   (GET /api/auth/me.php), remembers the answer, and tells the header/aside when it changes.

   • No account is ever required: when the server is absent (static hosting) or offline, everything degrades to
     "signed out" and the ledger keeps working.
   • The ledger itself never travels here — only name, email and a picture URL the provider already gave us.
   • A server sign-in is mirrored into settings.account (sub: 'server') so the existing feature gates in auth.js
     (requireAuth) treat the user as linked. Signing out removes it again. */

import * as S from './store.js';

let me = null;               // last answer: {signed_in, name, email, avatar, created, provider, providers[], csrf}
let syncEngine = null;       // §6 registers { pending(): number }
const subs = new Set();

export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => subs.forEach(fn => { try { fn(); } catch { /* a bad listener must not break the others */ } });

export function current() { return me; }
export function csrfToken() { return (me && me.csrf) || ''; }
export function serverProviders() { return (me && Array.isArray(me.providers)) ? me.providers : []; }

function normalise(j) {
  const signed = !!(j && j.signed_in);
  return {
    signed_in: signed,
    name: signed ? String(j.name || '') : '',
    email: signed ? String(j.email || '') : '',
    avatar: signed && typeof j.avatar === 'string' && j.avatar.startsWith('/') ? j.avatar : null,
    created: signed ? Number(j.created) || 0 : 0,
    provider: signed ? String(j.provider || '') : '',
    providers: Array.isArray(j && j.providers) ? j.providers.filter(p => typeof p === 'string') : [],
    csrf: typeof (j && j.csrf) === 'string' ? j.csrf : ''
  };
}

const fetchOf = (impl) => impl || (typeof fetch === 'function' ? fetch : null);

/* Identity shown in the UI: the server session, else a local (preview / legacy) link, else null. */
export function identity(localSession) {
  if (me && me.signed_in) {
    return { source: 'server', name: me.name, email: me.email, avatar: me.avatar, created: me.created,
             provider: me.provider, preview: false, cached: !!me.cached };
  }
  const a = localSession;
  if (a && a.sub) {
    return { source: 'local', name: a.name || '', email: a.email || '', avatar: null,
             created: a.linked_at ? Math.floor(a.linked_at / 1000) : 0, provider: a.provider || '', preview: !!a.preview };
  }
  return null;
}

export function initialOf(name, email) {
  const s = String(name || email || '').trim();
  return s ? [...s][0].toLocaleUpperCase() : '?';
}

/* Sync dot: never red. 'offline' and 'off' are both grey; 'pending' is the calm amber; 'synced' is green. */
export function syncStatus({ online, engine } = {}) {
  const on = online === undefined ? (typeof navigator === 'undefined' || navigator.onLine !== false) : online;
  const eng = engine === undefined ? syncEngine : engine;
  if (!on) return 'offline';
  if (!eng) return 'off';
  return eng.pending() > 0 ? 'pending' : 'synced';
}
export function setSyncEngine(engine) { syncEngine = engine; emit(); }

async function mirrorLocal(next) {
  const acc = S.state.settings.account;
  if (next.signed_in) {
    const keep = acc && acc.sub === 'server' && acc.email === next.email && acc.name === next.name;
    if (!keep) {
      await S.saveProgress({ account: {
        provider: next.provider, sub: 'server', email: next.email, name: next.name, picture: '', preview: false,
        linked_at: Date.now(), expires_at: Date.now() + 30 * 864e5
      } });
    }
  } else if (acc && acc.sub === 'server') {
    await S.saveProgress({ account: null });
  }
}

function cachedIdentity() {
  const c = S.state && S.state.settings && S.state.settings.account_server;
  return c ? Object.assign(normalise({ signed_in: true, ...c }), { cached: true }) : null;
}

/* Ask the server. On any failure (static host, offline, 5xx) keep what we already know. */
export async function refresh({ fetchImpl } = {}) {
  const f = fetchOf(fetchImpl);
  if (!f) return me;
  let next = null;
  try {
    const res = await f('/api/auth/me.php', { headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) throw new Error('http ' + res.status);
    next = normalise(await res.json());
  } catch {
    if (!me) { const c = cachedIdentity(); if (c) { me = c; emit(); } }
    return me;
  }
  const changed = JSON.stringify(next) !== JSON.stringify(me);
  me = next;
  try {
    await mirrorLocal(next);
    const cache = next.signed_in ? { name: next.name, email: next.email, avatar: next.avatar, created: next.created, provider: next.provider } : null;
    if (JSON.stringify(cache) !== JSON.stringify(S.state.settings.account_server || null)) await S.saveProgress({ account_server: cache });
  } catch { /* storage trouble must not break sign-in state */ }
  if (changed) emit();
  return me;
}

/* POST /api/auth/logout.php with the double-submit CSRF token. Resolves true on success. */
export async function signOut({ fetchImpl } = {}) {
  const f = fetchOf(fetchImpl);
  if (!f) return false;
  try {
    const res = await f('/api/auth/logout.php', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'X-CSRF-Token': csrfToken(), Accept: 'application/json' }
    });
    if (!res.ok) throw new Error('http ' + res.status);
  } catch { return false; }
  me = { ...normalise({ signed_in: false, providers: serverProviders() }) };
  try {
    const acc = S.state.settings.account;
    await S.saveProgress({ account_server: null, ...(acc && acc.sub === 'server' ? { account: null } : {}) });
  } catch { /* ignore */ }
  emit();
  await refresh({ fetchImpl });          // pick up a fresh CSRF token for the signed-out state
  return true;
}

/* Test hook. */
export function _reset() { me = null; syncEngine = null; subs.clear(); }
