/* DYON §6 — end-to-end encrypted sync engine (client). Optional: nothing here runs unless the user turned sync on.
   Local-first: IndexedDB stays the source of truth; this module mirrors changes to /api/sync/* as opaque encrypted blobs.
   Sync bookkeeping lives in its OWN IndexedDB ("dyon-sync") so export, import and wipe of the ledger never touch it.
   Never synced: `audit` (each device keeps its own hash chain), `spiritual` (device-private, R-V03), `settings`. */
import * as db from './db.js';
import * as S from './store.js';
import * as ACCT from './account.js';
import * as SC from './sync-crypto.js';

export const SYNCED = new Set(['counterparties', 'commitments', 'installments', 'fulfilments', 'witnesses', 'evidence', 'promisesToPay',
  'plans', 'reminders', 'respites', 'disputes', 'settlements', 'releases', 'transfers', 'checkins', 'reflections']);
/* Fields where two different edits are never resolved silently: the newer wins, the other stays one tap away. */
export const CRITICAL = new Set(['amount_minor', 'unit_code', 'due_on', 'direction', 'type', 'status']);
const MAX_BLOB = 1_400_000, BATCH = 100, DEBOUNCE = 3000, EVERY = 5 * 60_000, BEAT = 30_000;

/* ---------- pure merge (unit-tested) ---------- */
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** Three-way merge of two edited copies of one record. Fields only one side touched are taken as is; fields both
 *  touched go to the newer edit, and CRITICAL ones are reported so the other value stays reachable. */
export function merge3(base, local, remote) {
  base = base || {};
  const localNewer = (local.updated_at || 0) >= (remote.updated_at || 0);
  const out = {}, conflicts = [];
  for (const k of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
    const b = base[k], l = local[k], r = remote[k];
    let v;
    if (same(l, r)) v = l;
    else if (same(l, b)) v = r;
    else if (same(r, b)) v = l;
    else {
      v = localNewer ? l : r;
      if (CRITICAL.has(k)) conflicts.push({ field: k, mine: l ?? null, theirs: r ?? null, kept: localNewer ? 'mine' : 'theirs' });
    }
    if (v !== undefined) out[k] = v;
  }
  return { merged: out, conflicts };
}

/* ---------- sync-state database ---------- */
let _sdb = null;
function sopen() {
  return _sdb ||= new Promise((res, rej) => {
    const r = indexedDB.open('dyon-sync', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('recs', { keyPath: 'k' }); d.createObjectStore('conflicts', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const sdo = (store, mode, fn) => sopen().then(d => new Promise((res, rej) => {
  const t = d.transaction(store, mode); const r = fn(t.objectStore(store));
  t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error);
}));
const kvGet = (k) => sdo('kv', 'readonly', os => os.get(k));
const kvSet = (k, v) => sdo('kv', 'readwrite', os => os.put(v, k));
const kvDel = (k) => sdo('kv', 'readwrite', os => os.delete(k));
const allOf = (store) => sdo(store, 'readonly', os => os.getAll()).then(x => x || []);
const putRec = (r) => sdo('recs', 'readwrite', os => os.put(r));
const putConf = (c) => sdo('conflicts', 'readwrite', os => os.put(c));
const delConf = (id) => sdo('conflicts', 'readwrite', os => os.delete(id));
const clearAll = () => Promise.all([sdo('recs', 'readwrite', os => os.clear()), sdo('conflicts', 'readwrite', os => os.clear()), kvDel('state')]);

/* ---------- module state ---------- */
let state = null;                    // {enabled, userId, deviceId, deviceLabel, since, lastSynced, key(CryptoKey), problem}
const recs = new Map();              // "table|id" → {k, table, id, rev, dirty, ver, deleted, base}
const confs = new Map();             // "table|id" → {id, table, rid, fields:[{field,mine,theirs,kept}], at}
let syncing = false, netOk = true, running = null, again = false, timer = null, every = null, beatT = null, backoff = 0, retryT = null;
let fetchImpl = null, inited = false;
const subs = new Set();
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => { subs.forEach(f => { try { f(); } catch {} }); ACCT_emit(); };
let acctEmitPending = false;
function ACCT_emit() { if (acctEmitPending) return; acctEmitPending = true; queueMicrotask(() => { acctEmitPending = false; ACCT.setSyncEngine(state && state.enabled ? engine : null); }); }

const engine = { pending: () => pendingCount() };
const keyOf = (t, id) => t + '|' + id;
export const pendingCount = () => { let n = 0; for (const r of recs.values()) if (r.dirty) n++; return n; };

export function status() {
  const enabled = !!(state && state.enabled);
  return {
    enabled, userId: state && state.userId, deviceId: state && state.deviceId, deviceLabel: state && state.deviceLabel,
    phase: !enabled ? 'off' : syncing ? 'syncing' : !netOk || (typeof navigator !== 'undefined' && navigator.onLine === false) ? 'offline' : state.problem === 'paused' ? 'paused' : 'idle',
    pending: pendingCount(), conflicts: confs.size, lastSynced: (state && state.lastSynced) || 0, problem: (state && state.problem) || null
  };
}
export function netState() { const s = status(); return s.phase === 'syncing' ? 'syncing' : (s.phase === 'offline' ? 'offline' : 'online'); }
export const isEnabled = () => !!(state && state.enabled);
export const lastProblem = () => (state && !state.enabled && state.problem) || null;
export function configure(o = {}) { if (o.fetchImpl) fetchImpl = o.fetchImpl; }

/* ---------- HTTP ---------- */
export class ApiError extends Error { constructor(status, code, msg) { super(msg || code); this.status = status; this.code = code; } }
async function api(path, { method = 'GET', body, retry = true } = {}) {
  const f = fetchImpl || ((...a) => fetch(...a));
  let res;
  try {
    res = await f(path, { method, credentials: 'same-origin', cache: 'no-store',
      headers: Object.assign({ Accept: 'application/json' }, method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': ACCT.csrfToken() }),
      body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new ApiError(0, 'network', 'offline'); }
  let j = null; try { j = await res.json(); } catch {}
  if (res.ok) return j;
  const code = (j && j.error && j.error.code) || 'http_' + res.status;
  if (res.status === 403 && code === 'csrf' && retry) { await ACCT.refresh(); return api(path, { method, body, retry: false }); }
  throw new ApiError(res.status, code);
}
export const serverMeta = () => api('/api/sync/meta.php');

/* ---------- local write hook ---------- */
function markDirty(table, id, deleted) {
  if (!state || !state.enabled || !SYNCED.has(table)) return;
  const k = keyOf(table, id);
  const r = recs.get(k) || { k, table, id, rev: 0, dirty: false, ver: 0, deleted: false, base: null };
  r.dirty = true; r.ver++; r.deleted = !!deleted; r.skipped = false;
  recs.set(k, r); putRec(r).catch(() => {});
  emit(); schedule(DEBOUNCE);
}

/* ---------- scheduling ---------- */
function schedule(ms) { clearTimeout(timer); timer = setTimeout(() => { syncNow(); }, ms); }
function startTimers() {
  stopTimers();
  every = setInterval(() => syncNow(), EVERY);
  const beat = async () => {
    let ok = true;
    try { const r = await (fetchImpl || fetch)('/api/ping.php', { method: 'HEAD', cache: 'no-store', credentials: 'omit' }); ok = r.ok; } catch { ok = false; }
    const was = netOk; netOk = ok;
    backoff = ok ? 0 : Math.min(backoff ? backoff * 2 : BEAT, 5 * 60_000);
    if (was !== ok) { emit(); if (ok) syncNow(); }
    beatT = setTimeout(beat, backoff || BEAT);
  };
  beatT = setTimeout(beat, BEAT);
  window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVis);
}
function stopTimers() {
  clearTimeout(timer); clearInterval(every); clearTimeout(beatT); clearTimeout(retryT);
  window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline);
  document.removeEventListener('visibilitychange', onVis);
}
const onOnline = () => { netOk = true; emit(); syncNow(); };
const onOffline = () => { netOk = false; emit(); };
const onVis = () => { if (document.visibilityState === 'hidden') { if (pendingCount()) syncNow(); } else syncNow(); };

/* ---------- the cycle ---------- */
export function syncNow() {
  if (!state || !state.enabled) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => { try { do { again = false; await cycle(); } while (again); } finally { running = null; } })();
  return running;
}
async function cycle() {
  if (!state || !state.enabled) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { emit(); return; }
  const me = ACCT.current();
  if (me && me.signed_in === false) { state.problem = 'paused'; emit(); return; }
  syncing = true; emit();
  try {
    await push(); await pull();
    state.lastSynced = Date.now(); if (state.problem === 'paused' || state.problem === 'retry') state.problem = null;
    netOk = true; backoff = 0; await kvSet('state', state);
  } catch (e) { await onFail(e); }
  finally { syncing = false; emit(); }
}
async function onFail(e) {
  if (!(e instanceof ApiError)) { console.warn('[sync]', e); state.problem = 'retry'; return retryLater(); }
  if (e.status === 0) { netOk = false; return retryLater(); }
  if (e.status === 401) { state.problem = 'paused'; return; }
  if (e.code === 'device_revoked') return disableLocal('revoked');
  if (e.code === 'not_set_up') return disableLocal('wiped');
  if (e.code === 'unknown_device') { state.problem = 'other_account'; return; }
  if (e.code === 'quota_exceeded') { state.problem = 'quota'; return; }
  state.problem = 'retry'; retryLater();
}
function retryLater() { retryDelay = Math.min(retryDelay ? retryDelay * 2 : 10_000, 5 * 60_000); clearTimeout(retryT); retryT = setTimeout(() => syncNow(), retryDelay); }
let retryDelay = 0;

const BODY_BUDGET = 1_500_000;
/* Merge bases are kept to resolve later edits; drop big fields (scanned images) so the sync database stays small. */
const slim = (o) => { if (!o) return null; const c = {}; for (const [k, v] of Object.entries(o)) if (!(typeof v === 'string' && v.length > 20000)) c[k] = v; return c; };

async function sendBatch(changes, meta) {
  if (!changes.length) return false;
  const res = await api('/api/sync/push.php', { method: 'POST', body: { device_id: state.deviceId, changes } });
  for (const a of res.accepted) {
    const m = meta.find(x => x.rec.table === a.table && x.rec.id === a.id); if (!m) continue;
    m.rec.rev = a.rev; m.rec.base = slim(m.local); if (m.rec.ver === m.ver) m.rec.dirty = false;
    await putRec(m.rec);
  }
  let touched = false;
  for (const c of res.conflicts) touched = (await applyRemote({ table: c.table, id: c.id, rev: c.rev, deleted: c.deleted, blob: c.blob })) || touched;
  if (touched) await reloadStore();
  return true;
}
async function push() {
  for (let pass = 0; pass < 6; pass++) {
    const dirty = [...recs.values()].filter(r => r.dirty);
    if (!dirty.length) return;
    let changes = [], meta = [], bytes = 0;
    for (const rec of dirty) {
      const local = rec.deleted ? null : await db.get(rec.table, rec.id);
      const rev = rec.rev + 1;
      const blob = await SC.encryptRecord(state.key, state.userId, rec.table, rec.id, rev, local || { deleted: true });
      if (blob.length > MAX_BLOB) { rec.dirty = false; rec.skipped = true; await putRec(rec); continue; }   // too large for sync (e.g. a big scan): stays on this device
      if (changes.length && (changes.length >= BATCH || bytes + blob.length > BODY_BUDGET)) { await sendBatch(changes, meta); changes = []; meta = []; bytes = 0; }
      changes.push({ table: rec.table, id: rec.id, base_rev: rec.rev, rev, deleted: !local, blob }); meta.push({ rec, ver: rec.ver, local }); bytes += blob.length;
    }
    await sendBatch(changes, meta);
  }
}
async function pull() {
  let touched = false;
  for (let guard = 0; guard < 200; guard++) {
    const r = await api(`/api/sync/pull.php?device=${state.deviceId}&since=${state.since}&limit=500`);
    for (const ch of r.changes) touched = (await applyRemote(ch)) || touched;
    state.since = r.next; await kvSet('state', state);
    if (!r.more) break;
  }
  if (touched) await reloadStore();
}
async function reloadStore() { await S.load(); S.emit(); }

/** Applies one server change. Returns true when local data changed. */
async function applyRemote(ch) {
  if (!SYNCED.has(ch.table)) return false;
  const k = keyOf(ch.table, ch.id);
  const rec = recs.get(k) || { k, table: ch.table, id: ch.id, rev: 0, dirty: false, ver: 0, deleted: false, base: null };
  if (ch.rev <= rec.rev) return false;                                      // our own push coming back, or already applied
  let remote;
  try { remote = await SC.decryptRecord(state.key, state.userId, ch.table, ch.id, ch.rev, ch.blob); }
  catch { state.bad = (state.bad || 0) + 1; return false; }                  // failed authentication: never apply, never crash the sync
  if (ch.deleted) remote = null;
  const local = await db.get(ch.table, ch.id);
  const prevRev = rec.rev;
  let changed = true;
  if (!rec.dirty) {
    if (remote) await db.put(ch.table, remote, { quiet: true }); else if (local) await db.del(ch.table, ch.id, { quiet: true }); else changed = false;
    rec.base = slim(remote); rec.deleted = !remote; rec.dirty = false;
  } else if (!remote) {
    rec.base = null; changed = false;                                        // they deleted, we edited: the edit is kept and will be pushed again
  } else if (!local || rec.deleted) {
    await db.put(ch.table, remote, { quiet: true });                         // we deleted, they edited: never drop their edit
    rec.base = slim(remote); rec.deleted = false; rec.dirty = false;
  } else {
    const { merged, conflicts } = merge3(rec.base, local, remote);
    await db.put(ch.table, merged, { quiet: true });
    rec.base = slim(remote); rec.dirty = !same(merged, remote); if (rec.dirty) rec.ver++;
    if (conflicts.length) {
      const c = { id: k, table: ch.table, rid: ch.id, fields: conflicts, at: Date.now() };
      confs.set(k, c); await putConf(c);
    }
    changed = !same(merged, local);
  }
  rec.rev = ch.rev; recs.set(k, rec); await putRec(rec);
  if (changed) { try { await db.logEvent('sync', ch.id, 'sync.apply', { table: ch.table, rev: [prevRev, ch.rev], deleted: !remote }); } catch {} }
  return changed;
}

/* ---------- conflicts ("Needs a look") ---------- */
export const conflicts = () => [...confs.values()].sort((a, b) => b.at - a.at);
export async function resolveConflict(id, choice) {
  const c = confs.get(id); if (!c) return false;
  if (choice === 'other') {
    const rec = await db.get(c.table, c.rid);
    if (rec) {
      for (const f of c.fields) rec[f.field] = f.kept === 'mine' ? f.theirs : f.mine;
      rec.updated_at = Date.now();
      await db.put(c.table, rec);                                            // non-quiet: queued and synced like any edit
      await db.logEvent('sync', c.rid, 'sync.resolve', { table: c.table, fields: c.fields.map(f => f.field) });
      await reloadStore();
    }
  }
  confs.delete(id); await delConf(id); emit();
  return true;
}

/* ---------- turning sync on / off ---------- */
async function install(dataKey, userId, deviceId, deviceLabel) {
  state = { enabled: true, userId, deviceId, deviceLabel, since: 0, lastSynced: 0, key: await SC.lockedCopy(dataKey), problem: null };
  recs.clear(); confs.clear(); await clearAll(); await kvSet('state', state);
  db.setWriteHook(markDirty); db.setWipeHook(onWipe);
  for (const t of SYNCED) for (const o of await db.getAll(t)) {            // first upload: every existing record
    const k = keyOf(t, o.id); const r = { k, table: t, id: o.id, rev: 0, dirty: true, ver: 1, deleted: false, base: null }; recs.set(k, r); await putRec(r);
  }
  startTimers(); emit();
  syncNow();
}
const needSignedIn = () => { const me = ACCT.current(); if (!me || !me.signed_in) throw new ApiError(401, 'unauthorized'); };

/** Step 1 of a new setup: derive keys locally. Nothing is uploaded yet. */
export const prepareKeys = (passphrase) => SC.createKeys(passphrase);
/** Step 2: after the user re-typed words from the phrase. */
export async function activateNew({ keys, deviceLabel }) {
  needSignedIn();
  await api('/api/sync/setup.php', { method: 'POST', body: keys.meta });
  const m = await serverMeta();
  const d = await api('/api/sync/devices.php', { method: 'POST', body: { action: 'register', label: deviceLabel } });
  await install(keys.dataKey, m.user_id, d.id, deviceLabel);
}
/** Connect another device to an existing synced copy, with the passphrase or the 24-word phrase. */
export async function activateJoin({ passphrase, phrase, deviceLabel }) {
  needSignedIn();
  const m = await serverMeta(); if (!m.set_up) throw new ApiError(404, 'not_set_up');
  const dk = phrase ? await SC.unlockWithPhrase(phrase, m) : await SC.unlockWithPassphrase(passphrase, m);
  const d = await api('/api/sync/devices.php', { method: 'POST', body: { action: 'register', label: deviceLabel } });
  await install(dk, m.user_id, d.id, deviceLabel);
}
async function disableLocal(problem) {
  stopTimers(); db.setWriteHook(null);
  state = { enabled: false, problem, userId: state.userId }; await kvSet('state', state);
  recs.clear(); confs.clear(); await sdo('recs', 'readwrite', os => os.clear()); await sdo('conflicts', 'readwrite', os => os.clear());
  emit();
}
/** Turn sync off on this device. The ledger on this device is never touched. */
export async function turnOff({ revoke = true } = {}) {
  if (!state) return;
  if (revoke && state.enabled && state.deviceId) { try { await api('/api/sync/devices.php', { method: 'POST', body: { action: 'revoke', id: state.deviceId } }); } catch {} }
  stopTimers(); db.setWriteHook(null); db.setWipeHook(null);
  state = null; recs.clear(); confs.clear(); await clearAll(); emit();
}
export async function deleteServerCopy() {
  needSignedIn();
  await api('/api/sync/wipe.php', { method: 'POST', body: { confirm: 'delete' } });
  await turnOff({ revoke: false });
}
export async function dismissProblem() { if (state && !state.enabled) { state = null; await kvDel('state'); emit(); } }
/* "Delete all data" on this device must not leave a sync mirror that would re-download it: sync turns off here (never gated, RL-09). */
async function onWipe() { await turnOff({ revoke: false }); }

/* ---------- devices ---------- */
export async function devices() { return (await api('/api/sync/devices.php')).devices; }
export const renameDevice = (id, label) => api('/api/sync/devices.php', { method: 'POST', body: { action: 'rename', id, label } }).then(() => { if (state && id === state.deviceId) { state.deviceLabel = label; kvSet('state', state); } });
export const revokeDevice = (id) => api('/api/sync/devices.php', { method: 'POST', body: { action: 'revoke', id } });

/* ---------- boot ---------- */
export async function init() {
  if (inited) return; inited = true;
  try {
    const st = await kvGet('state');
    if (!st) return;
    state = st;
    if (!state.enabled) { emit(); return; }
    for (const r of await allOf('recs')) recs.set(r.k, r);
    for (const c of await allOf('conflicts')) confs.set(c.id, c);
    db.setWriteHook(markDirty); db.setWipeHook(onWipe);
    startTimers(); emit(); syncNow();
  } catch (e) { console.warn('[sync] init failed', e); }
}
export function _reset() { stopTimers(); db.setWriteHook(null); db.setWipeHook(null); state = null; recs.clear(); confs.clear(); inited = false; fetchImpl = null; syncing = false; netOk = true; running = null; subs.clear(); }
export function _inject(st) { state = st; }
