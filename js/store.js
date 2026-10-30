/* DYON — domain store, derivations and red-line-safe mutations (§1.5, §4, §7, §8).
   State lives in IndexedDB; this module is the single write path so that every
   mutation produces an append-only audit event. */

import * as db from './db.js';
import { isMonetary, isCurrency, convertMinor, unitShort } from './units.js';

/* ---------- Enumerations with stable codes (R-V01) ---------- */
export const TYPES = ['T-01','T-02','T-03','T-04','T-05','T-06','T-07','T-08','T-09','T-10','T-11','T-12','T-13'];
export const TOP_TYPES = ['T-01','T-02','T-04','T-07','T-05'];
export const DIRECTIONS = ['I_OWE', 'OWED_TO_ME', 'MUTUAL'];
export const DUE_MODES = ['date', 'when_able', 'on_return', 'recurring', 'none'];
export const STATUSES = ['draft','proposed','acknowledged','active','partial','respite','disputed',
  'settled','fulfilled','released','transferred','written_off','archived'];
export const OPEN_STATUSES = ['draft','proposed','acknowledged','active','partial','respite','disputed','settled'];
export const CLOSED_STATUSES = ['fulfilled','released','transferred','written_off','archived'];
export const TONES = ['gentle','neutral','formal','islamic'];
export const VISIBILITY = ['private','shared','witnessed'];
export const CP_KINDS = ['person','group','institution','self','divine_private'];

export const TYPE_DEFAULT_UNIT = {
  'T-01': null, 'T-02': null, 'T-03': null, 'T-04': 'ITEM', 'T-05': 'HOUR',
  'T-06': 'HOUR', 'T-07': 'PROMISE', 'T-08': 'ITEM', 'T-09': 'PROMISE',
  'T-10': 'FASTDAY', 'T-11': 'OCCASION', 'T-12': null, 'T-13': null
};
export const TYPE_MODULE = {
  'T-04': 'trusts', 'T-08': 'trusts', 'T-05': 'services', 'T-06': 'services',
  'T-07': 'promises', 'T-09': 'promises', 'T-11': 'promises', 'T-10': 'spiritual'
};

/* ---------- Default settings (§6.6) ---------- */
export const DEFAULT_SETTINGS = {
  id: 'app',
  display_name: '',
  locale: 'en',
  dir_auto: true,
  digits: 'latn',
  calendar_primary: 'gregory',
  calendar_secondary: 'none',
  base_currency: 'USD',
  converted_totals: false,     // OFF by default (§6.6)
  week_start: 'mon',
  theme: 'system',
  islamic_mode: false,         // OFF by default
  calm_mode: false,
  spiritual_ledger: false,     // OFF by default
  blur_amounts: false,
  discreet_mode: false,
  pin_enabled: false,
  pin: '',
  quiet_from: '21:00',
  quiet_to: '09:00',
  prayer_quiet: false,
  default_tone: 'gentle',
  self_reminders: true,        // R-D25 on by default
  hardship: false,             // self-declared only (RL-07)
  evidence_threshold_minor: 50000,
  executor_name: '',
  last_estate_export: null,
  onboarded: false,
  hidden_widgets: [],
  widget_order: [],
  insights_dismissed: [],
  checkin_day: 5,
  tips_level: 'normal',
  last_direction: 'I_OWE',
  last_unit: 'USD',
  guide_read: [],              // chapter ids read (v2.0 §1.9: IndexedDB, not localStorage)
  tour_done: false,
  created_at: Date.now()
};

/* ---------- In-memory cache ---------- */
export const state = {
  settings: { ...DEFAULT_SETTINGS },
  counterparties: [],
  commitments: [],
  installments: [],
  fulfilments: [],
  witnesses: [],
  evidence: [],
  promisesToPay: [],
  plans: [],
  reminders: [],
  respites: [],
  disputes: [],
  settlements: [],
  releases: [],
  transfers: [],
  checkins: [],
  reflections: [],
  spiritual: [],
  audit: []
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit() { listeners.forEach(fn => fn()); }

export async function load() {
  await db.open();
  const s = await db.get('settings', 'app');
  state.settings = Object.assign({ ...DEFAULT_SETTINGS }, s || {});
  if (!s) await db.put('settings', state.settings);
  for (const store of ['counterparties','commitments','installments','fulfilments','witnesses',
    'evidence','promisesToPay','plans','reminders','respites','disputes','settlements',
    'releases','transfers','checkins','reflections','spiritual','audit']) {
    state[store] = await db.getAll(store);
  }
  state.audit.sort((a, b) => b.at - a.at);
  await migrateLegacyProgress();
  return state;
}

/* v1 kept guide/tour progress in localStorage, outside export/import.
   Move it into the settings row once, then drop the old keys. */
async function migrateLegacyProgress() {
  let read = null, done = null;
  try {
    read = localStorage.getItem('dyon.guide.read');
    done = localStorage.getItem('dyon.tour.done');
  } catch { return; }
  if (read === null && done === null) return;
  const patch = {};
  try {
    const arr = JSON.parse(read || '[]');
    if (Array.isArray(arr) && arr.length) patch.guide_read = [...new Set([...(state.settings.guide_read || []), ...arr.map(String)])];
  } catch {}
  if (done === '1') patch.tour_done = true;
  await saveProgress(patch);
  try { localStorage.removeItem('dyon.guide.read'); localStorage.removeItem('dyon.tour.done'); } catch {}
}

/* UI progress (guide chapters read, tour finished, banners dismissed).
   Written to the same IndexedDB settings row — so export/import carry it —
   but without an audit event or a re-render: it is not ledger data. */
export async function saveProgress(patch) {
  Object.assign(state.settings, patch, { id: 'app' });
  await db.put('settings', state.settings);
  return state.settings;
}

export async function saveSettings(patch) {
  const before = { ...state.settings };
  state.settings = Object.assign(state.settings, patch, { id: 'app' });
  await db.put('settings', state.settings);
  const d = db.diffOf(before, state.settings);
  if (Object.keys(d).length) await logAudit('settings', 'app', 'settings.update', d);
  emit();
  return state.settings;
}

async function logAudit(entity, id, action, diff) {
  const ev = await db.logEvent(entity, id, action, diff);
  state.audit.unshift(ev);
  return ev;
}

/* ---------- Counterparties ---------- */
export async function upsertCounterparty(data) {
  const existing = data.id ? state.counterparties.find(c => c.id === data.id) : null;
  const cp = Object.assign({
    id: db.uid('p'),
    kind: 'person',
    alias: '',
    relationship_label: '',
    relationship_health: null,   // user-entered only (R-D05 / RL-07)
    contact_hint: '',
    note: '',
    created_at: Date.now()
  }, existing || {}, data);
  cp.updated_at = Date.now();
  await db.put('counterparties', cp);
  const i = state.counterparties.findIndex(c => c.id === cp.id);
  if (i >= 0) state.counterparties[i] = cp; else state.counterparties.push(cp);
  await logAudit('counterparty', cp.id, existing ? 'counterparty.update' : 'counterparty.create',
    db.diffOf(existing, cp));
  emit();
  return cp;
}

export function findCounterpartyByName(name) {
  const n = (name || '').trim().toLowerCase();
  return state.counterparties.find(c => (c.alias || '').trim().toLowerCase() === n) || null;
}
export async function ensureCounterparty(name, kind = 'person') {
  const found = findCounterpartyByName(name);
  if (found) return found;
  return upsertCounterparty({ alias: (name || '').trim() || '—', kind });
}
export function cpOf(id) { return state.counterparties.find(c => c.id === id) || null; }
export function cpName(id) { const c = cpOf(id); return c ? c.alias : '—'; }

/* RL-08: delete a non-user's data; the commitment survives with an alias. */
export async function anonymizeCounterparty(id) {
  const cp = cpOf(id);
  if (!cp) return;
  const before = { ...cp };
  cp.alias = 'Deleted contact';
  cp.contact_hint = '';
  cp.note = '';
  cp.anonymized_at = Date.now();
  await db.put('counterparties', cp);
  await logAudit('counterparty', id, 'counterparty.anonymize', db.diffOf(before, cp));
  emit();
}

/* ---------- Commitments ---------- */
export function newCommitmentDraft(patch = {}) {
  const s = state.settings;
  return Object.assign({
    id: db.uid('c'),
    type: 'T-01',
    direction: s.last_direction || 'I_OWE',
    counterparty_id: null,
    counterparty_name: '',
    unit_code: s.last_unit || s.base_currency,
    amount_minor: 0,
    description: '',
    incurred_on: todayISO(),
    due_on: null,
    due_mode: 'none',
    recurrence: null,
    status: 'draft',
    visibility: 'private',
    approximate: false,
    tone: s.default_tone,
    notes: '',
    gold_reference: '',
    guarantor: '',
    pledge_note: '',
    criterion: '',
    streak: 0,
    archived: false,
    created_at: Date.now()
  }, patch);
}

export async function createCommitment(data) {
  const c = newCommitmentDraft(data);
  /* RL-01 guard — the schema must never carry interest-like fields. */
  assertNoRiba(c);
  if (c.counterparty_name && !c.counterparty_id) {
    const cp = await ensureCounterparty(c.counterparty_name, c.counterparty_kind || 'person');
    c.counterparty_id = cp.id;
  }
  delete c.counterparty_name; delete c.counterparty_kind;
  if (c.status === 'draft') c.status = c.visibility === 'private' ? 'active' : 'proposed';
  c.updated_at = Date.now();
  await db.put('commitments', c);
  state.commitments.push(c);
  await logAudit('commitment', c.id, 'commitment.create', { created: [null, summarize(c)] });
  await saveSettings({ last_direction: c.direction, last_unit: c.unit_code });
  emit();
  return c;
}

export async function updateCommitment(id, patch, action = 'commitment.update') {
  const c = state.commitments.find(x => x.id === id);
  if (!c) return null;
  const before = { ...c };
  Object.assign(c, patch, { updated_at: Date.now() });
  assertNoRiba(c);
  await db.put('commitments', c);
  await logAudit('commitment', id, action, db.diffOf(before, c));
  emit();
  return c;
}

export function commitmentOf(id) { return state.commitments.find(c => c.id === id) || null; }

/* "Deleting" a shared commitment leaves a tombstone (R-M02). */
export async function deleteCommitment(id) {
  const c = commitmentOf(id);
  if (!c) return;
  if (c.visibility !== 'private') {
    await updateCommitment(id, { status: 'archived', tombstone: true }, 'commitment.tombstone');
    return;
  }
  await db.del('commitments', id);
  state.commitments = state.commitments.filter(x => x.id !== id);
  await logAudit('commitment', id, 'commitment.delete', { deleted: [summarize(c), null] });
  emit();
}

function summarize(c) {
  return { type: c.type, direction: c.direction, amount_minor: c.amount_minor, unit_code: c.unit_code,
    due_on: c.due_on, status: c.status, description: c.description };
}

/* RL-01 / R-M05: a runtime policy test mirroring the CI schema linter. */
const RIBA_RE = /interest|apr|penalty_rate|late_fee|compound|usury|riba_rate/i;
export function assertNoRiba(obj) {
  for (const k of Object.keys(obj)) {
    if (RIBA_RE.test(k)) throw new Error('RL-01 violation: forbidden field ' + k);
  }
  return true;
}

/* ---------- Installments (no interest: sum must equal principal) ---------- */
export async function setInstallments(commitmentId, count, firstDateISO, everyDays = 30) {
  const c = commitmentOf(commitmentId);
  if (!c || count < 1) return [];
  await clearChildren('installments', commitmentId);
  const base = Math.floor(c.amount_minor / count);
  const rem = c.amount_minor - base * count;
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(firstDateISO + 'T12:00:00');
    d.setDate(d.getDate() + i * everyDays);
    out.push({
      id: db.uid('i'), commitment_id: commitmentId, seq: i + 1,
      amount_minor: base + (i === count - 1 ? rem : 0),
      due_on: d.toISOString().slice(0, 10), status: 'pending'
    });
  }
  await db.putMany('installments', out);
  state.installments = state.installments.filter(x => x.commitment_id !== commitmentId).concat(out);
  await logAudit('commitment', commitmentId, 'installments.set', { count: [null, count] });
  emit();
  return out;
}
async function clearChildren(store, commitmentId) {
  const old = state[store].filter(x => x.commitment_id === commitmentId);
  for (const o of old) await db.del(store, o.id);
  state[store] = state[store].filter(x => x.commitment_id !== commitmentId);
}
export function installmentsOf(id) {
  return state.installments.filter(i => i.commitment_id === id).sort((a, b) => a.seq - b.seq);
}

/* ---------- Fulfilments ---------- */
export async function recordFulfilment(commitmentId, amount_minor, opts = {}) {
  const c = commitmentOf(commitmentId);
  if (!c) return null;
  const f = {
    id: db.uid('f'), commitment_id: commitmentId, amount_minor,
    unit_code: opts.unit_code || c.unit_code,
    on: opts.on || todayISO(), method_note: opts.method_note || '',
    recorded_by: 'me', confirmed_by: opts.confirmed_by || null, created_at: Date.now()
  };
  await db.put('fulfilments', f);
  state.fulfilments.push(f);
  await logAudit('commitment', commitmentId, 'fulfilment.record',
    { amount_minor: [null, amount_minor], on: [null, f.on] });
  const paid = paidMinor(commitmentId);
  if (paid >= c.amount_minor && c.amount_minor > 0) {
    await updateCommitment(commitmentId, { status: 'fulfilled', closed_at: Date.now() }, 'commitment.fulfilled');
  } else if (paid > 0) {
    await updateCommitment(commitmentId, { status: 'partial' }, 'commitment.partial');
  }
  emit();
  return f;
}
export function fulfilmentsOf(id) {
  return state.fulfilments.filter(f => f.commitment_id === id).sort((a, b) => (a.on < b.on ? 1 : -1));
}
export function paidMinor(id) {
  return state.fulfilments.filter(f => f.commitment_id === id)
    .reduce((s, f) => s + (f.amount_minor || 0), 0);
}
export function remainingMinor(c) {
  if (!c) return 0;
  const rel = state.releases.filter(r => r.commitment_id === c.id && !r.undone)
    .reduce((s, r) => s + (r.scope === 'partial' ? (r.amount_minor || 0) : 0), 0);
  return Math.max(0, (c.amount_minor || 0) - paidMinor(c.id) - rel);
}
export function progressPct(c) {
  if (!c || !c.amount_minor) return CLOSED_STATUSES.includes(c?.status) ? 100 : 0;
  return Math.min(100, Math.round((paidMinor(c.id) / c.amount_minor) * 100));
}

/* ---------- Promise-to-pay ---------- */
export async function addPromiseToPay(commitmentId, amount_minor, by_date) {
  const p = { id: db.uid('ptp'), commitment_id: commitmentId, by_user: 'me',
    amount_minor, by_date, kept: null, created_at: Date.now() };
  await db.put('promisesToPay', p);
  state.promisesToPay.push(p);
  await logAudit('commitment', commitmentId, 'ptp.create', { by_date: [null, by_date] });
  emit();
  return p;
}
export function ptpOf(id) { return state.promisesToPay.filter(p => p.commitment_id === id); }

/* ---------- Respite (inẓār) ---------- */
export async function requestRespite(commitmentId, proposed_due_on, reason, by = 'me') {
  const r = { id: db.uid('r'), commitment_id: commitmentId, requested_by: by,
    reason: reason || '', proposed_due_on, status: 'pending', created_at: Date.now() };
  await db.put('respites', r);
  state.respites.push(r);
  await logAudit('commitment', commitmentId, 'respite.request', { proposed_due_on: [null, proposed_due_on] });
  emit();
  return r;
}
export async function answerRespite(respiteId, decision, newDate) {
  const r = state.respites.find(x => x.id === respiteId);
  if (!r) return;
  const before = { ...r };
  r.status = decision; r.answered_at = Date.now();
  if (newDate) r.proposed_due_on = newDate;
  await db.put('respites', r);
  await logAudit('commitment', r.commitment_id, 'respite.' + decision, db.diffOf(before, r));
  if (decision === 'granted') {
    await updateCommitment(r.commitment_id, { status: 'respite', due_on: r.proposed_due_on, due_mode: 'date' },
      'commitment.respite');
  }
  emit();
  return r;
}
export function respitesOf(id) { return state.respites.filter(r => r.commitment_id === id); }

/* ---------- Release (ibrāʾ) with 24h undo guard (RL-10) ---------- */
export const UNDO_MS = 24 * 60 * 60 * 1000;
export async function releaseCommitment(commitmentId, scope = 'full', amount_minor = null, note = '') {
  const rel = { id: db.uid('rel'), commitment_id: commitmentId, released_by: 'me',
    scope, amount_minor, sadaqah_intention_note: note,
    undo_until: Date.now() + UNDO_MS, undone: false, created_at: Date.now() };
  await db.put('releases', rel);
  state.releases.push(rel);
  await logAudit('commitment', commitmentId, 'release.' + scope, { scope: [null, scope] });
  if (scope === 'full') {
    await updateCommitment(commitmentId, { status: 'released', closed_at: Date.now() }, 'commitment.released');
  } else {
    const c = commitmentOf(commitmentId);
    if (remainingMinor(c) <= 0) {
      await updateCommitment(commitmentId, { status: 'released', closed_at: Date.now() }, 'commitment.released');
    }
  }
  emit();
  return rel;
}
export async function undoRelease(releaseId) {
  const rel = state.releases.find(r => r.id === releaseId);
  if (!rel || rel.undone || Date.now() > rel.undo_until) return false;
  rel.undone = true; rel.undone_at = Date.now();
  await db.put('releases', rel);
  await logAudit('commitment', rel.commitment_id, 'release.undo', { undone: [false, true] });
  await updateCommitment(rel.commitment_id, { status: 'active', closed_at: null }, 'commitment.reopen');
  emit();
  return true;
}
export function releasesOf(id) { return state.releases.filter(r => r.commitment_id === id && !r.undone); }
export function activeUndoWindows() {
  return state.releases.filter(r => !r.undone && Date.now() < r.undo_until);
}

/* ---------- Disputes & settlements ---------- */
export async function openDispute(commitmentId, claim) {
  const d = { id: db.uid('d'), commitment_id: commitmentId, opened_by: 'me',
    claims: [{ by: 'me', text: claim, at: Date.now() }], status: 'open', created_at: Date.now() };
  await db.put('disputes', d);
  state.disputes.push(d);
  await logAudit('commitment', commitmentId, 'dispute.open', { claim: [null, claim] });
  await updateCommitment(commitmentId, { status: 'disputed' }, 'commitment.disputed');
  emit();
  return d;
}
export async function addDisputeClaim(disputeId, by, text) {
  const d = state.disputes.find(x => x.id === disputeId);
  if (!d) return;
  d.claims.push({ by, text, at: Date.now() });
  await db.put('disputes', d);
  await logAudit('commitment', d.commitment_id, 'dispute.claim', { by: [null, by] });
  emit();
}
export async function resolveDispute(disputeId, how) {
  const d = state.disputes.find(x => x.id === disputeId);
  if (!d) return;
  d.status = how; d.resolved_at = Date.now();
  await db.put('disputes', d);
  await logAudit('commitment', d.commitment_id, 'dispute.' + how, { status: ['open', how] });
  await updateCommitment(d.commitment_id, { status: how === 'settled' ? 'settled' : 'active' }, 'commitment.resolved');
  emit();
}
export function disputesOf(id) { return state.disputes.filter(d => d.commitment_id === id); }

export async function proposeSettlement(commitmentId, new_terms) {
  const s = { id: db.uid('s'), commitment_id: commitmentId, new_terms,
    agreed_by: ['me'], status: 'proposed', created_at: Date.now() };
  await db.put('settlements', s);
  state.settlements.push(s);
  await logAudit('commitment', commitmentId, 'settlement.propose', { terms: [null, new_terms] });
  emit();
  return s;
}
export async function acceptSettlement(settlementId) {
  const s = state.settlements.find(x => x.id === settlementId);
  if (!s) return;
  s.status = 'agreed'; s.agreed_by = ['me', 'counterparty']; s.agreed_at = Date.now();
  await db.put('settlements', s);
  const patch = { status: 'settled' };
  if (s.new_terms.amount_minor != null) patch.amount_minor = s.new_terms.amount_minor;
  if (s.new_terms.unit_code) patch.unit_code = s.new_terms.unit_code;
  if (s.new_terms.due_on) { patch.due_on = s.new_terms.due_on; patch.due_mode = 'date'; }
  await logAudit('commitment', s.commitment_id, 'settlement.accept', { terms: [null, s.new_terms] });
  await updateCommitment(s.commitment_id, patch, 'commitment.settled');
  emit();
}
export function settlementsOf(id) { return state.settlements.filter(s => s.commitment_id === id); }

/* ---------- Transfer (ḥawālah) — all parties consent ---------- */
export async function transferCommitment(commitmentId, toName, consents) {
  const cp = await ensureCounterparty(toName);
  const tr = { id: db.uid('tr'), commitment_id: commitmentId, to_counterparty_id: cp.id,
    consents, created_at: Date.now() };
  await db.put('transfers', tr);
  state.transfers.push(tr);
  await logAudit('commitment', commitmentId, 'transfer.record', { to: [null, cp.alias] });
  await updateCommitment(commitmentId, { status: 'transferred', closed_at: Date.now() }, 'commitment.transferred');
  emit();
  return tr;
}

/* ---------- Witnesses & evidence ---------- */
export async function addWitness(commitmentId, name, scope = 'terms') {
  const w = { id: db.uid('w'), commitment_id: commitmentId, name, scope,
    attested_at: null, created_at: Date.now() };
  await db.put('witnesses', w);
  state.witnesses.push(w);
  await logAudit('commitment', commitmentId, 'witness.add', { name: [null, name] });
  emit();
  return w;
}
export async function attestWitness(witnessId) {
  const w = state.witnesses.find(x => x.id === witnessId);
  if (!w) return;
  w.attested_at = Date.now();
  await db.put('witnesses', w);
  await logAudit('commitment', w.commitment_id, 'witness.attest', { name: [null, w.name] });
  emit();
}
export function witnessesOf(id) { return state.witnesses.filter(w => w.commitment_id === id); }

export async function addEvidence(commitmentId, file) {
  const buf = await file.arrayBuffer();
  const hash = await db.sha256(buf);
  const dataUrl = await new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.readAsDataURL(file);
  });
  const e = { id: db.uid('e'), commitment_id: commitmentId, name: file.name,
    mime: file.type, size: file.size, sha256: hash, data: dataUrl,
    uploaded_by: 'me', uploaded_at: Date.now() };
  await db.put('evidence', e);
  state.evidence.push(e);
  await logAudit('commitment', commitmentId, 'evidence.add', { sha256: [null, hash] });
  emit();
  return e;
}
export function evidenceOf(id) { return state.evidence.filter(e => e.commitment_id === id); }

/* ---------- Reminders (S-03, R-D20..R-D26) ---------- */
export const REMINDER_CAP_DAYS = 7;
export const REMINDER_CAP_PER_PERSON_MONTH = 3;

export function reminderAllowed(commitmentId) {
  const c = commitmentOf(commitmentId);
  if (!c) return { ok: false };
  const now = Date.now();
  const last = state.reminders
    .filter(r => r.commitment_id === commitmentId && r.audience === 'counterparty')
    .sort((a, b) => b.sent_at - a.sent_at)[0];
  if (last && now - last.sent_at < REMINDER_CAP_DAYS * 864e5) {
    return { ok: false, reason: 'per_commitment', next: last.sent_at + REMINDER_CAP_DAYS * 864e5 };
  }
  const monthAgo = now - 30 * 864e5;
  const ids = state.commitments.filter(x => x.counterparty_id === c.counterparty_id).map(x => x.id);
  const count = state.reminders.filter(r => ids.includes(r.commitment_id) &&
    r.audience === 'counterparty' && r.sent_at > monthAgo).length;
  if (count >= REMINDER_CAP_PER_PERSON_MONTH) return { ok: false, reason: 'per_person' };
  return { ok: true };
}

export async function logReminder(commitmentId, audience, tone, text) {
  const r = { id: db.uid('rm'), commitment_id: commitmentId, audience, tone,
    text, sent_at: Date.now(), scheduled_at: null };
  await db.put('reminders', r);
  state.reminders.push(r);
  await logAudit('commitment', commitmentId, 'reminder.' + audience, { tone: [null, tone] });
  emit();
  return r;
}
export function remindersOf(id) { return state.reminders.filter(r => r.commitment_id === id); }

/* R-D23: copy linting — banned phrase families block the "send" affordance. */
const BANNED = [
  /\bshame\b/i, /\bdisgrace\b/i, /\bliar\b/i, /\bthief\b/i, /\bsue\b/i, /\blawyer\b/i,
  /\bcourt\b/i, /\bpolice\b/i, /\blegal action\b/i, /\bhypocrit/i, /\bmunafiq\b/i,
  /عار/, /فضيح/, /كاذب/, /لص/, /سأقاضيك/, /المحكمة/, /الشرطة/, /منافق/
];
export function lintMessage(text) {
  const hits = BANNED.filter(re => re.test(text || ''));
  return { clean: hits.length === 0, hits: hits.length };
}

/* ---------- Check-ins & reflections ---------- */
export async function addCheckin(score) {
  const c = { id: db.uid('ck'), score, at: Date.now(), on: todayISO() };
  await db.put('checkins', c);
  state.checkins.push(c);
  await logAudit('wellbeing', c.id, 'checkin.add', { score: [null, score] });
  emit();
  return c;
}
export function latestCheckin() {
  return [...state.checkins].sort((a, b) => b.at - a.at)[0] || null;
}
export function checkinDelta() {
  const cs = [...state.checkins].sort((a, b) => a.at - b.at);
  if (cs.length < 2) return null;
  const firstHalf = cs.slice(0, Math.ceil(cs.length / 2));
  const lastHalf = cs.slice(Math.ceil(cs.length / 2));
  const avg = a => a.reduce((s, x) => s + x.score, 0) / a.length;
  return +(avg(lastHalf) - avg(firstHalf)).toFixed(2);
}
export async function addReflection(moved, next, kindness) {
  const r = { id: db.uid('rf'), moved, next, kindness, at: Date.now() };
  await db.put('reflections', r);
  state.reflections.push(r);
  emit();
  return r;
}

/* ---------- Spiritual ledger (T-10) — device-private, never exported by default ---------- */
export async function addSpiritual(data) {
  const s = Object.assign({ id: db.uid('sp'), label: '', unit_code: 'FASTDAY',
    count: 0, done: 0, note: '', opt_in_export: false, created_at: Date.now() }, data);
  await db.put('spiritual', s);
  state.spiritual.push(s);
  emit();
  return s;
}
export async function updateSpiritual(id, patch) {
  const s = state.spiritual.find(x => x.id === id);
  if (!s) return;
  Object.assign(s, patch);
  await db.put('spiritual', s);
  emit();
}
export async function deleteSpiritual(id) {
  await db.del('spiritual', id);
  state.spiritual = state.spiritual.filter(s => s.id !== id);
  emit();
}

/* ---------- Plans (S-04, S-16) ---------- */
export async function savePlan(plan) {
  const p = Object.assign({ id: 'plan_main', strategy: 'snowball',
    capacity: {}, created_at: Date.now() }, plan, { id: 'plan_main' });
  await db.put('plans', p);
  const i = state.plans.findIndex(x => x.id === p.id);
  if (i >= 0) state.plans[i] = p; else state.plans.push(p);
  await logAudit('plan', p.id, 'plan.save', { strategy: [null, p.strategy] });
  emit();
  return p;
}
export function getPlan() { return state.plans.find(p => p.id === 'plan_main') || null; }

export function planOrder(strategy) {
  const open = openCommitments().filter(c => c.direction === 'I_OWE' && isMonetary(c.unit_code));
  const score = c => {
    switch (strategy) {
      case 'snowball': return remainingMinor(c);
      case 'avalanche_urgency': return c.due_on ? new Date(c.due_on).getTime() : 9e15;
      case 'relationship_first': {
        const cp = cpOf(c.counterparty_id);
        return -((cp && cp.relationship_health) || 0) * 1e12 + remainingMinor(c);
      }
      default: return c.created_at;
    }
  };
  return open.sort((a, b) => score(a) - score(b));
}
export function monthsToClear() {
  const plan = getPlan();
  if (!plan) return null;
  const out = {};
  for (const [unit, cap] of Object.entries(plan.capacity || {})) {
    if (!cap) continue;
    const total = openCommitments()
      .filter(c => c.direction === 'I_OWE' && c.unit_code === unit)
      .reduce((s, c) => s + remainingMinor(c), 0);
    out[unit] = total > 0 ? Math.ceil(total / cap) : 0;
  }
  return out;
}

/* ================= DERIVATIONS ================= */
export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function daysUntil(iso) {
  if (!iso) return null;
  const a = new Date(todayISO() + 'T00:00:00').getTime();
  const b = new Date(iso + 'T00:00:00').getTime();
  return Math.round((b - a) / 864e5);
}

export function visibleCommitments() {
  // T-10 lives in its own private store; the ledger never mixes it in.
  return state.commitments.filter(c => c.type !== 'T-10');
}
export function openCommitments() {
  return visibleCommitments().filter(c => OPEN_STATUSES.includes(c.status));
}
export function closedCommitments() {
  return visibleCommitments().filter(c => CLOSED_STATUSES.includes(c.status));
}

/* W-01 Net position: per-unit rows; never summed across units (R-D03) */
export function netPosition() {
  const rows = {};
  for (const c of openCommitments()) {
    const u = c.unit_code;
    rows[u] = rows[u] || { unit: u, owe: 0, owed: 0, count: 0 };
    const rem = remainingMinor(c);
    if (c.direction === 'I_OWE') rows[u].owe += rem;
    else if (c.direction === 'OWED_TO_ME') rows[u].owed += rem;
    else { rows[u].owe += rem; rows[u].owed += rem; }
    rows[u].count++;
  }
  return Object.values(rows)
    .map(r => ({ ...r, net: r.owed - r.owe }))
    .sort((a, b) => (b.owe + b.owed) - (a.owe + a.owed));
}
export function convertedTotal(base) {
  let owe = 0, owed = 0, ok = true;
  for (const r of netPosition()) {
    if (!isMonetary(r.unit)) continue;
    const a = convertMinor(r.owe, r.unit, base);
    const b = convertMinor(r.owed, r.unit, base);
    if (a === null || b === null) { ok = false; continue; }
    owe += a; owed += b;
  }
  return { owe, owed, net: owed - owe, ok };
}

/* W-02 Clarity Score — completeness of records, never worthiness (R-D04) */
export function clarityScore() {
  const open = openCommitments();
  if (!open.length) return { score: 100, checks: [], total: 0 };
  const checks = [
    { key: 'due', label: 'due_date', ok: open.filter(c => c.due_on || c.due_mode === 'when_able' || c.due_mode === 'on_return').length },
    { key: 'ack', label: 'acknowledged', ok: open.filter(c => ['acknowledged','active','partial','settled','respite'].includes(c.status) && c.visibility !== 'private').length + open.filter(c => c.visibility === 'private').length },
    { key: 'desc', label: 'described', ok: open.filter(c => (c.description || '').trim().length > 2).length },
    { key: 'exact', label: 'not_approximate', ok: open.filter(c => !c.approximate).length },
    { key: 'fresh', label: 'not_stale', ok: open.filter(c => !isStale(c)).length },
    { key: 'evidence', label: 'evidence', ok: open.filter(c => evidenceOf(c.id).length > 0 || (c.amount_minor || 0) < state.settings.evidence_threshold_minor).length }
  ];
  const total = open.length;
  const score = Math.round(checks.reduce((s, c) => s + c.ok / total, 0) / checks.length * 100);
  return { score, checks: checks.map(c => ({ ...c, missing: total - c.ok })), total };
}
export function isStale(c) {
  const last = c.updated_at || c.created_at;
  return !c.due_on && Date.now() - last > 180 * 864e5;
}

/* W-03 Next due */
export function nextDue() {
  return openCommitments()
    .filter(c => c.due_on)
    .sort((a, b) => (a.due_on < b.due_on ? -1 : 1))[0] || null;
}

/* W-04 Action queue */
export function actionQueue() {
  const items = [];
  for (const c of openCommitments()) {
    if (c.status === 'proposed' && c.visibility !== 'private')
      items.push({ kind: 'confirm', commitment: c, priority: 1 });
    if (c.status === 'disputed')
      items.push({ kind: 'dispute', commitment: c, priority: 0 });
  }
  for (const r of state.respites.filter(r => r.status === 'pending')) {
    const c = commitmentOf(r.commitment_id);
    if (c) items.push({ kind: 'respite', commitment: c, respite: r, priority: 1 });
  }
  for (const s of state.settlements.filter(s => s.status === 'proposed')) {
    const c = commitmentOf(s.commitment_id);
    if (c) items.push({ kind: 'settlement', commitment: c, settlement: s, priority: 2 });
  }
  for (const p of state.promisesToPay.filter(p => p.kept === null && p.by_date < todayISO())) {
    const c = commitmentOf(p.commitment_id);
    if (c && OPEN_STATUSES.includes(c.status)) items.push({ kind: 'ptp', commitment: c, ptp: p, priority: 2 });
  }
  const snoozed = JSON.parse(localStorage.getItem('dyon.snoozed') || '{}');
  return items
    .filter(i => !snoozed[i.commitment.id] || snoozed[i.commitment.id] < Date.now())
    .sort((a, b) => a.priority - b.priority);
}
export function snoozeItem(commitmentId, days = 3) {
  const s = JSON.parse(localStorage.getItem('dyon.snoozed') || '{}');
  s[commitmentId] = Date.now() + Math.min(days, 7) * 864e5;  // max 7 days
  localStorage.setItem('dyon.snoozed', JSON.stringify(s));
  emit();
}

/* W-05 Upcoming 30 days */
export function upcoming(days = 30) {
  const out = [];
  for (const c of openCommitments()) {
    if (c.due_on) {
      const d = daysUntil(c.due_on);
      if (d !== null && d <= days) out.push({ on: c.due_on, days: d, commitment: c, kind: 'due' });
    }
    for (const i of installmentsOf(c.id)) {
      if (i.status !== 'pending') continue;
      const d = daysUntil(i.due_on);
      if (d !== null && d >= 0 && d <= days)
        out.push({ on: i.due_on, days: d, commitment: c, installment: i, kind: 'installment' });
    }
  }
  return out.sort((a, b) => (a.on < b.on ? -1 : 1));
}

/* W-06 People */
export function peopleSummary() {
  return state.counterparties.map(cp => {
    const cs = visibleCommitments().filter(c => c.counterparty_id === cp.id);
    const open = cs.filter(c => OPEN_STATUSES.includes(c.status));
    const balances = {};
    for (const c of open) {
      const u = c.unit_code;
      balances[u] = balances[u] || 0;
      balances[u] += (c.direction === 'I_OWE' ? -1 : 1) * remainingMinor(c);
    }
    const last = cs.reduce((m, c) => Math.max(m, c.updated_at || c.created_at), 0);
    return { cp, total: cs.length, open: open.length, balances, last };
  }).sort((a, b) => b.open - a.open || b.last - a.last);
}

/* Module slices */
export function byModule(mod) {
  return visibleCommitments().filter(c => TYPE_MODULE[c.type] === mod);
}

/* W-11 Fulfilled & released wall */
export function closureWall(limit = 12) {
  return closedCommitments()
    .sort((a, b) => (b.closed_at || b.updated_at || 0) - (a.closed_at || a.updated_at || 0))
    .slice(0, limit);
}

/* W-17 Estate readiness */
export function estateReadiness() {
  const open = openCommitments();
  if (!open.length) return { pct: 100, missing: [] };
  const complete = open.filter(c => c.description && (c.due_on || c.due_mode !== 'none') && c.counterparty_id);
  const pct = Math.round(complete.length / open.length * 100);
  return { pct, missing: open.filter(c => !complete.includes(c)) };
}

/* W-19 Currency exposure */
export function unitExposure() {
  const m = {};
  for (const c of openCommitments()) {
    m[c.unit_code] = m[c.unit_code] || { unit: c.unit_code, count: 0, minor: 0 };
    m[c.unit_code].count++;
    m[c.unit_code].minor += remainingMinor(c);
  }
  return Object.values(m).sort((a, b) => b.count - a.count);
}

/* W-20 Insights — one non-judgmental tip at a time */
export function insights() {
  const out = [];
  const open = openCommitments();
  const noDue = open.filter(c => !c.due_on && c.due_mode === 'none');
  if (noDue.length) out.push({ id: 'no_due', count: noDue.length, route: '#/ledger?filter=no_due' });
  const approx = open.filter(c => c.approximate);
  if (approx.length) out.push({ id: 'approximate', count: approx.length, route: '#/ledger?filter=approximate' });
  const unshared = open.filter(c => c.visibility === 'private' && (c.amount_minor || 0) > 0);
  if (unshared.length > 2) out.push({ id: 'unshared', count: unshared.length, route: '#/ledger' });
  const noEvidence = open.filter(c => (c.amount_minor || 0) >= state.settings.evidence_threshold_minor && !evidenceOf(c.id).length);
  if (noEvidence.length) out.push({ id: 'no_evidence', count: noEvidence.length, route: '#/vault' });
  const stale = open.filter(isStale);
  if (stale.length) out.push({ id: 'stale', count: stale.length, route: '#/ledger' });
  if (!getPlan() && open.filter(c => c.direction === 'I_OWE').length >= 3)
    out.push({ id: 'no_plan', count: 0, route: '#/plans' });
  if (!state.settings.executor_name && open.length >= 5)
    out.push({ id: 'no_executor', count: 0, route: '#/reports' });
  const dismissed = state.settings.insights_dismissed || [];
  return out.filter(i => !dismissed.includes(i.id));
}

/* Dashboard persona state (§7.12) */
export function userState() {
  const open = openCommitments();
  const owe = open.filter(c => c.direction === 'I_OWE');
  const owed = open.filter(c => c.direction === 'OWED_TO_ME');
  const ck = latestCheckin();
  if (!visibleCommitments().length) return 'empty';
  if (state.disputes.some(d => d.status === 'open')) return 'in_dispute';
  if (owe.length >= 15 || (ck && ck.score <= 2)) return 'overwhelm';
  if (!owe.length && visibleCommitments().length) return 'after_payoff';
  if (open.length < 3) return 'new';
  if (owed.length / Math.max(1, open.length) > 0.7) return 'mostly_creditor';
  if (open.length <= 10) return 'light';
  return 'heavy';
}

/* KPIs (§7.16) — private, local only */
export function kpis() {
  const all = visibleCommitments();
  const shared = all.filter(c => c.visibility !== 'private');
  const ack = shared.filter(c => !['draft','proposed'].includes(c.status));
  const closed = closedCommitments();
  const fulfilled = closed.filter(c => ['fulfilled','released','settled','transferred'].includes(c.status));
  const rel = state.releases.length;
  const undone = state.releases.filter(r => r.undone).length;
  return {
    clarity: clarityScore().score,
    ackPct: shared.length ? Math.round(ack.length / shared.length * 100) : null,
    fulfilPct: all.length ? Math.round(fulfilled.length / all.length * 100) : 0,
    disputesPer100: all.length ? +(state.disputes.length / all.length * 100).toFixed(1) : 0,
    checkinDelta: checkinDelta(),
    releaseUndoPct: rel ? Math.round(undone / rel * 100) : 0,
    commitments: all.length,
    people: state.counterparties.length
  };
}

/* ---------- Export / import (RL-09) ---------- */
export function exportPayload(includeSpiritual = false) {
  const payload = {
    app: 'DYON', spec_version: 'v0.1', exported_at: new Date().toISOString(),
    settings: { ...state.settings, pin: '' },
    counterparties: state.counterparties,
    commitments: state.commitments.filter(c => c.type !== 'T-10'),
    installments: state.installments,
    fulfilments: state.fulfilments,
    witnesses: state.witnesses,
    promisesToPay: state.promisesToPay,
    plans: state.plans,
    reminders: state.reminders,
    respites: state.respites,
    disputes: state.disputes,
    settlements: state.settlements,
    releases: state.releases,
    transfers: state.transfers,
    checkins: state.checkins,
    reflections: state.reflections,
    audit: state.audit,
    evidence: state.evidence.map(e => ({ ...e, data: undefined, note: 'binary omitted' }))
  };
  // R-V03: spiritual records are excluded unless each one is explicitly opted in.
  payload.spiritual = includeSpiritual ? state.spiritual.filter(s => s.opt_in_export) : [];
  return payload;
}

export async function importPayload(obj) {
  if (!obj || obj.app !== 'DYON') throw new Error('Not a DYON backup');
  const map = ['counterparties','commitments','installments','fulfilments','witnesses',
    'promisesToPay','plans','reminders','respites','disputes','settlements','releases',
    'transfers','checkins','reflections','audit','spiritual'];
  for (const s of map) {
    if (Array.isArray(obj[s]) && obj[s].length) await db.putMany(s, obj[s]);
  }
  if (obj.settings) await db.put('settings', Object.assign({ ...DEFAULT_SETTINGS }, obj.settings, { id: 'app' }));
  db.resetAuditTail();
  await load();
  emit();
}

export async function wipe() {
  await db.wipeAll();
  db.resetAuditTail();
  localStorage.removeItem('dyon.snoozed');
  await load();
  emit();
}

export { db };
