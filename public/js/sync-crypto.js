/* DYON §6 — client-side crypto for end-to-end encrypted sync. WebCrypto only.
   The server never sees the passphrase, the recovery phrase, the data key or any plaintext.
   Layout: random 256-bit data key (DK). Wrapping keys: PBKDF2(passphrase) and the recovery key (RK, 256 bit).
   Both wrap DK with AES-KW. key_check = AES-GCM(DK, constant) so a wrong passphrase is detected locally. */
import { WORDS } from './sync-wordlist.js';

export const KDF_MIN_ITER = 600000;
export const KDF_ITER = 600000;
const CHECK_PLAIN = 'dyon-sync-key-check-v1';
const enc = new TextEncoder(), dec = new TextDecoder();
const subtle = () => crypto.subtle;

export function b64(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64(s) {
  const p = String(s).replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(p + '='.repeat((4 - p.length % 4) % 4));
  const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u;
}

export class SyncCryptoError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }

/* ---------- passphrase / recovery wrapping ---------- */
async function passKey(pass, salt, iter) {
  if (!Number.isInteger(iter) || iter < KDF_MIN_ITER) throw new SyncCryptoError('kdf_too_weak', 'Key-derivation iterations below the minimum');
  const base = await subtle().importKey('raw', enc.encode(String(pass).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-KW', length: 256 }, false, ['wrapKey', 'unwrapKey']);
}
async function rawKwKey(raw) { return subtle().importKey('raw', raw, 'AES-KW', false, ['wrapKey', 'unwrapKey']); }
const wrap = (dk, kek) => subtle().wrapKey('raw', dk, kek, 'AES-KW');
async function unwrap(wrapped, kek) {
  try { return await subtle().unwrapKey('raw', wrapped, kek, 'AES-KW', { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']); }
  catch { throw new SyncCryptoError('bad_secret', 'Wrong passphrase or recovery phrase'); }
}
async function makeCheck(dk) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, dk, enc.encode(CHECK_PLAIN)));
  return b64(concat(iv, ct));
}
export async function verifyCheck(dk, keyCheck) {
  try {
    const u = unb64(keyCheck);
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, dk, u.slice(12));
    return dec.decode(pt) === CHECK_PLAIN;
  } catch { return false; }
}
function concat(a, b) { const o = new Uint8Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; }

/** Creates a new key set. Returns { dataKey, phrase, meta } — meta is the only part that is uploaded. */
export async function createKeys(passphrase, { iterations = KDF_ITER } = {}) {
  const dataKey = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const rk = crypto.getRandomValues(new Uint8Array(32));
  const meta = {
    salt: b64(salt), kdf_iter: iterations,
    wrapped_key: b64(await wrap(dataKey, await passKey(passphrase, salt, iterations))),
    wrapped_key_recovery: b64(await wrap(dataKey, await rawKwKey(rk))),
    key_check: await makeCheck(dataKey)
  };
  return { dataKey, phrase: await phraseFromBytes(rk), meta };
}
export async function unlockWithPassphrase(passphrase, meta) {
  const salt = unb64(meta.salt);
  const kek = await passKey(passphrase, salt, Number(meta.kdf_iter));     // refuses < 600 000 BEFORE doing any work
  const dk = await unwrap(unb64(meta.wrapped_key), kek);
  if (!(await verifyCheck(dk, meta.key_check))) throw new SyncCryptoError('bad_secret', 'Key check failed');
  return dk;
}
export async function unlockWithPhrase(phrase, meta) {
  const rk = await bytesFromPhrase(phrase);
  const dk = await unwrap(unb64(meta.wrapped_key_recovery), await rawKwKey(rk));
  if (!(await verifyCheck(dk, meta.key_check))) throw new SyncCryptoError('bad_secret', 'Key check failed');
  return dk;
}
/** Passphrase change: re-wrap the same data key; records need no re-encryption. */
export async function rewrapPassphrase(dataKey, newPass, meta, { iterations = KDF_ITER } = {}) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { ...meta, salt: b64(salt), kdf_iter: iterations, wrapped_key: b64(await wrap(dataKey, await passKey(newPass, salt, iterations))) };
}
/** Keeps the unlocked key on this device (non-extractable would break wrapping, so it stays an opaque CryptoKey in IndexedDB). */
export async function exportDataKey(dk) { return b64(await subtle().exportKey('raw', dk)); }
/** Re-import as NON-extractable so the copy kept on this device can encrypt/decrypt but never be read back out. */
export async function importDataKey(rawB64, extractable = false) {
  return subtle().importKey('raw', unb64(rawB64), { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']);
}
export async function lockedCopy(dk) { return importDataKey(await exportDataKey(dk), false); }

/* ---------- recovery phrase: BIP-39 style, 24 words = 256 bits + 8-bit SHA-256 checksum ---------- */
export async function phraseFromBytes(bytes) {
  if (bytes.length !== 32) throw new SyncCryptoError('bad_length');
  const sum = new Uint8Array(await subtle().digest('SHA-256', bytes))[0];
  const bits = [...bytes, sum].map(b => b.toString(2).padStart(8, '0')).join('');
  const words = [];
  for (let i = 0; i < 24; i++) words.push(WORDS[parseInt(bits.slice(i * 11, i * 11 + 11), 2)]);
  return words.join(' ');
}
export function normalisePhrase(p) { return String(p || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean); }
export async function bytesFromPhrase(phrase) {
  const w = normalisePhrase(phrase);
  if (w.length !== 24) throw new SyncCryptoError('bad_phrase', 'The recovery phrase has 24 words');
  let bits = '';
  for (const word of w) { const i = WORDS.indexOf(word); if (i < 0) throw new SyncCryptoError('bad_phrase', 'Unknown word'); bits += i.toString(2).padStart(11, '0'); }
  const bytes = new Uint8Array(32); for (let i = 0; i < 32; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const sum = parseInt(bits.slice(256), 2);
  if (new Uint8Array(await subtle().digest('SHA-256', bytes))[0] !== sum) throw new SyncCryptoError('bad_phrase', 'Checksum mismatch');
  return bytes;
}
/** Three distinct random positions (1-based) to re-type after showing the phrase. */
export function pickCheckWords(n = 3) {
  const s = new Set(); while (s.size < n) s.add(1 + crypto.getRandomValues(new Uint32Array(1))[0] % 24); return [...s].sort((a, b) => a - b);
}

/* ---------- record encryption ---------- */
export const aadOf = (userId, table, id, rev) => enc.encode(`${userId}|${table}|${id}|${rev}`);

/** Encrypt a JSON value → base64url of {v:1, iv, ct} (as a compact JSON blob). */
export async function encryptRecord(dk, userId, table, id, rev, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aadOf(userId, table, id, rev) }, dk, enc.encode(JSON.stringify(value))));
  return JSON.stringify({ v: 1, iv: b64(iv), ct: b64(ct) });
}
export async function decryptRecord(dk, userId, table, id, rev, blob) {
  let o; try { o = typeof blob === 'string' ? JSON.parse(blob) : blob; } catch { throw new SyncCryptoError('bad_blob'); }
  if (!o || o.v !== 1 || !o.iv || !o.ct) throw new SyncCryptoError('bad_blob', 'Unknown record format');
  try {
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(o.iv), additionalData: aadOf(userId, table, id, rev) }, dk, unb64(o.ct));
    return JSON.parse(dec.decode(pt));
  } catch { throw new SyncCryptoError('tampered', 'Record failed authentication'); }
}
