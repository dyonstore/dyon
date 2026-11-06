/* DYON — IndexedDB persistence layer (§8).
   Everything stays on this device. No network calls, no accounts, no servers.
   R-M02: append-only, hash-chained audit log. Edits create events with diffs;
   nothing is ever removed from history. */

const DB_NAME = 'dyon';
const DB_VERSION = 1;

export const STORES = [
  'settings',      // single-row app state
  'counterparties',
  'commitments',
  'installments',
  'fulfilments',
  'witnesses',
  'evidence',
  'promisesToPay',
  'plans',
  'reminders',
  'respites',
  'disputes',
  'settlements',
  'releases',
  'transfers',
  'checkins',
  'reflections',
  'spiritual',     // T-10, device-private, excluded from export unless opted in
  'audit'          // append-only, hash-chained
];

let _db = null;

export function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          const os = db.createObjectStore(s, { keyPath: 'id' });
          if (s === 'commitments') {
            os.createIndex('status', 'status', { unique: false });
            os.createIndex('counterparty_id', 'counterparty_id', { unique: false });
            os.createIndex('due_on', 'due_on', { unique: false });
          }
          if (['installments', 'fulfilments', 'witnesses', 'evidence', 'promisesToPay',
               'reminders', 'respites', 'disputes', 'settlements', 'releases', 'transfers'].includes(s)) {
            os.createIndex('commitment_id', 'commitment_id', { unique: false });
          }
          if (s === 'audit') os.createIndex('at', 'at', { unique: false });
        }
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return open().then(db => db.transaction(store, mode).objectStore(store));
}

export async function getAll(store) {
  const os = await tx(store);
  return new Promise((res, rej) => {
    const r = os.getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
}
export async function get(store, id) {
  const os = await tx(store);
  return new Promise((res, rej) => {
    const r = os.get(id);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}
export async function put(store, obj) {
  const os = await tx(store, 'readwrite');
  return new Promise((res, rej) => {
    const r = os.put(obj);
    r.onsuccess = () => res(obj);
    r.onerror = () => rej(r.error);
  });
}
export async function putMany(store, arr) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, 'readwrite');
    const os = t.objectStore(store);
    arr.forEach(o => os.put(o));
    t.oncomplete = () => res(arr.length);
    t.onerror = () => rej(t.error);
  });
}
export async function del(store, id) {
  const os = await tx(store, 'readwrite');
  return new Promise((res, rej) => {
    const r = os.delete(id);
    r.onsuccess = () => res(true);
    r.onerror = () => rej(r.error);
  });
}
export async function clearStore(store) {
  const os = await tx(store, 'readwrite');
  return new Promise((res, rej) => {
    const r = os.clear();
    r.onsuccess = () => res(true);
    r.onerror = () => rej(r.error);
  });
}
export async function wipeAll() {
  for (const s of STORES) await clearStore(s);
}

/* ---------- ids & hashing ---------- */
export function uid(prefix = 'c') {
  const rnd = crypto.getRandomValues(new Uint8Array(8));
  return prefix + '_' + Array.from(rnd).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256(text) {
  const buf = typeof text === 'string' ? new TextEncoder().encode(text) : text;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- append-only, hash-chained audit (R-M02) ---------- */
let _lastHash = null;

export async function auditTail() {
  if (_lastHash !== null) return _lastHash;
  const all = await getAll('audit');
  all.sort((a, b) => a.at - b.at);
  // the tail is the event whose hash nobody points back to
  const pointed = new Set(all.map(e => e.prev_hash));
  const tail = all.filter(e => !pointed.has(e.hash));
  _lastHash = tail.length ? tail[tail.length - 1].hash : 'genesis';
  return _lastHash;
}

/* Writes are serialised through one promise queue: two saves in the same
   tick would otherwise both read the same tail and fork the chain. */
let _queue = Promise.resolve();
export function logEvent(entity, entity_id, action, diff) {
  const run = async () => {
    const prev_hash = await auditTail();
    const at = Date.now();
    const id = uid('a');
    const payload = JSON.stringify({ id, entity, entity_id, action, diff, at, prev_hash });
    const hash = await sha256(payload);
    const ev = { id, entity, entity_id, action, diff: diff || null, at, actor: 'me', prev_hash, hash };
    await put('audit', ev);
    _lastHash = hash;
    return ev;
  };
  const p = _queue.then(run, run);
  _queue = p.catch(() => {});
  return p;
}
/* After an import or wipe the in-memory tail must be re-read. */
export function resetAuditTail() { _lastHash = null; }

/* Verify the chain — used by Reports to prove Sidq in data. It walks the
   links from genesis (timestamps can tie within a millisecond, so ordering
   by time alone is not reliable). */
export async function verifyChain() {
  const all = await getAll('audit');
  const byPrev = new Map();
  for (const ev of all) {
    if (byPrev.has(ev.prev_hash)) return { ok: false, at: ev.id, reason: 'fork' };
    byPrev.set(ev.prev_hash, ev);
  }
  let prev = 'genesis', count = 0;
  while (byPrev.has(prev)) {
    const ev = byPrev.get(prev);
    const expect = await sha256(JSON.stringify({
      id: ev.id, entity: ev.entity, entity_id: ev.entity_id, action: ev.action,
      diff: ev.diff, at: ev.at, prev_hash: ev.prev_hash
    }));
    if (expect !== ev.hash) return { ok: false, at: ev.id, reason: 'hash mismatch' };
    prev = ev.hash; count++;
  }
  if (count !== all.length) {
    const orphan = all.find(ev => ev.prev_hash !== 'genesis' && !all.some(x => x.hash === ev.prev_hash));
    return { ok: false, at: orphan ? orphan.id : '?', reason: 'prev_hash mismatch' };
  }
  return { ok: true, count };
}

export function diffOf(before, after) {
  const d = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (k === 'updated_at') continue;
    const a = before ? before[k] : undefined;
    const b = after ? after[k] : undefined;
    if (JSON.stringify(a) !== JSON.stringify(b)) d[k] = [a ?? null, b ?? null];
  }
  return d;
}
