/* DYON — self tests. Covers the parts where a silent bug would be dangerous:
   integer money maths (R-M01), validation rules, the RL-01 riba guard,
   release/undo (RL-10), reminder caps (R-D20) and the audit hash chain (R-M02). */

import { toMinor, fromMinor, minorDigits, bankersRound, convertMinor, formatAmount, inputValue } from './units.js';
import * as VAL from './validate.js';
import * as S from './store.js';
import * as db from './db.js';
import { parseNaturalLanguage } from './content.js';
import { setLocale, setDigits, t } from './i18n.js';
import * as AUTH from './auth.js';
import * as QR from './qr.js';
import qrcode from './vendor/qrcode-generator.js';
import { GUIDE, TOURS, SCREEN_HELP } from './guide-content.js';
import { glossaryEntries, planSteps, tourDone, readChapters } from './guide.js';
import { AUTH_CONFIG } from './auth-config.js';
import { ensureLocale as __ensure, LOCALES } from './i18n.js';
await __ensure('ar'); await __ensure('fr');


const results = [];
function check(name, fn) {
  try {
    const out = fn();
    if (out === true || out === undefined) results.push({ name, ok: true });
    else results.push({ name, ok: false, detail: String(out) });
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
  }
}
async function checkAsync(name, fn) {
  try {
    const out = await fn();
    if (out === true || out === undefined) results.push({ name, ok: true });
    else results.push({ name, ok: false, detail: String(out) });
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
  }
}
const eq = (a, b, msg) => a === b ? true : `${msg || ''} expected ${b}, got ${a}`;

setLocale('en');
setDigits('latn');

/* ---------- money: integer minor units only (R-M01) ---------- */
check('minor digits: USD=2, JPY=0, KWD=3', () =>
  eq(`${minorDigits('USD')}${minorDigits('JPY')}${minorDigits('KWD')}`, '203'));

check('toMinor handles 2-dp currency', () => eq(toMinor('500.50', 'USD'), 50050));
check('toMinor handles 0-dp currency', () => eq(toMinor('1500', 'JPY'), 1500));
check('toMinor handles 3-dp currency', () => eq(toMinor('12.345', 'KWD'), 12345));
check('toMinor pads short decimals', () => eq(toMinor('7.5', 'USD'), 750));
check('toMinor truncates excess decimals', () => eq(toMinor('1.999', 'USD'), 199));
check('toMinor strips thousands separators', () => eq(toMinor('1,250.00', 'USD'), 125000));
check('toMinor reads Arabic-Indic digits', () => eq(toMinor('٥٠٠', 'SAR'), 50000));
check('toMinor reads Arabic decimal separator', () => eq(toMinor('٥٠٠٫٥٠', 'SAR'), 50050));
check('toMinor on empty is 0', () => eq(toMinor('', 'USD'), 0));
check('round trip 2dp', () => eq(fromMinor(toMinor('99.99', 'USD'), 'USD'), '99.99'));
check('round trip 0dp', () => eq(fromMinor(toMinor('250', 'JPY'), 'JPY'), '250'));
check('no float drift on 0.1+0.2 style sums', () =>
  eq(toMinor('0.10', 'USD') + toMinor('0.20', 'USD'), 30));

check("banker's rounding half-even", () =>
  eq([bankersRound(0.5), bankersRound(1.5), bankersRound(2.5), bankersRound(3.5)].join(','), '0,2,2,4'));

check('FX conversion is display-only and reversible in magnitude', () => {
  const sar = convertMinor(10000, 'USD', 'SAR');   // 100 USD
  return sar > 37000 && sar < 38000 ? true : `got ${sar}`;
});
check('FX returns null for unknown pairs', () => eq(convertMinor(100, 'ITEM', 'USD'), null));

/* ---------- validation rules ---------- */
function fakeInput(value) { return { value, setAttribute() {}, removeAttribute() {}, addEventListener() {} }; }

check('amount rule rejects empty', () => {
  const i = fakeInput('');
  return VAL.amountRule(i, () => 'USD')() ? true : 'should reject empty';
});
check('amount rule rejects zero', () => {
  const i = fakeInput('0');
  return VAL.amountRule(i, () => 'USD')() ? true : 'should reject zero';
});
check('amount rule rejects letters', () => {
  const i = fakeInput('abc');
  return VAL.amountRule(i, () => 'USD')() ? true : 'should reject letters';
});
check('amount rule rejects too many decimals for JPY', () => {
  const i = fakeInput('10.5');
  return VAL.amountRule(i, () => 'JPY')() ? true : 'JPY should reject decimals';
});
check('amount rule accepts valid 2dp', () => {
  const i = fakeInput('250.75');
  return VAL.amountRule(i, () => 'USD')() === null ? true : 'should accept';
});
check('amount rule enforces a max (remaining balance)', () => {
  const i = fakeInput('200');
  const msg = VAL.amountRule(i, () => 'USD', { max: () => 10000, maxLabel: () => '100' })();
  return msg ? true : 'should reject above remaining';
});
check('amount rule allows optional empty', () => {
  const i = fakeInput('');
  return VAL.amountRule(i, () => 'USD', { optional: true })() === null ? true : 'optional should pass';
});

check('date rule rejects a future "incurred" date', () => {
  const d = new Date(); d.setDate(d.getDate() + 5);
  const i = fakeInput(d.toISOString().slice(0, 10));
  return VAL.dateRule(i, { noFuture: true })() ? true : 'should reject future';
});
check('date rule rejects a past "due" date when future is required', () => {
  const d = new Date(); d.setDate(d.getDate() - 5);
  const i = fakeInput(d.toISOString().slice(0, 10));
  return VAL.dateRule(i, { future: true })() ? true : 'should reject past';
});
check('date rule rejects due before incurred', () => {
  const i = fakeInput('2026-01-01');
  return VAL.dateRule(i, { notBefore: () => '2026-06-01' })() ? true : 'should reject';
});
check('date rule accepts empty when optional', () =>
  VAL.dateRule(fakeInput(''))() === null ? true : 'optional date should pass');

check('installments rule rejects 1', () => {
  const i = fakeInput('1');
  return VAL.installmentsRule(i, () => true, () => '2026-01-01')() ? true : 'should reject 1';
});
check('installments rule rejects 61', () => {
  const i = fakeInput('61');
  return VAL.installmentsRule(i, () => true, () => '2026-01-01')() ? true : 'should reject 61';
});
check('installments rule needs an amount', () => {
  const i = fakeInput('4');
  return VAL.installmentsRule(i, () => false, () => '2026-01-01')() ? true : 'should require amount';
});
check('installments rule accepts 0 (no installments)', () => {
  const i = fakeInput('0');
  return VAL.installmentsRule(i, () => true, () => '2026-01-01')() === null ? true : 'zero should pass';
});

check('required text rejects whitespace only', () =>
  VAL.requiredText(fakeInput('   '))() ? true : 'should reject blanks');
check('text length cap enforced', () =>
  VAL.optionalText(fakeInput('x'.repeat(50)), 10)() ? true : 'should reject long text');
check('PIN rule rejects 3 digits', () => VAL.pinRule(fakeInput('123'))() ? true : 'should reject');
check('PIN rule rejects letters', () => VAL.pinRule(fakeInput('abcd'))() ? true : 'should reject');
check('PIN rule accepts 4 digits', () => VAL.pinRule(fakeInput('1234'))() === null ? true : 'should accept');

check('file check rejects oversize', () =>
  VAL.checkFile({ size: 9e6, type: 'image/png', name: 'a.png' }) ? true : 'should reject big file');
check('file check rejects wrong type', () =>
  VAL.checkFile({ size: 100, type: 'application/x-msdownload', name: 'a.exe' }) ? true : 'should reject exe');
check('file check accepts a small image', () =>
  VAL.checkFile({ size: 100, type: 'image/jpeg', name: 'a.jpg' }) === null ? true : 'should accept');

check('decimalsOf counts Arabic separators', () => eq(VAL.decimalsOf('12٫345'), 3));

/* ---------- natural language parsing ---------- */
check('NL: "Lent Sara 200 euros" → owed to me, EUR', () => {
  const r = parseNaturalLanguage('Lent Sara 200 euros, she\'ll pay me back on 1 March');
  return r.direction === 'OWED_TO_ME' && r.unit_code === 'EUR' && r.amount === '200'
    ? true : JSON.stringify(r);
});
check('NL: Arabic borrow phrase → I owe + riyal ambiguity flagged', () => {
  const r = parseNaturalLanguage('أخذت من أحمد ٥٠٠ ريال أردها بعد شهر');
  return r.direction === 'I_OWE' && r.unit_candidates.length > 1 &&
    r.confidence.includes('unit_ambiguous') ? true : JSON.stringify(r);
});
check('NL: "Holding my brother\'s laptop" → trust', () => {
  const r = parseNaturalLanguage("Holding my brother's laptop until he's back");
  return r.type === 'T-08' ? true : JSON.stringify(r);
});
check('NL: recurring promise flags a needed start date', () => {
  const r = parseNaturalLanguage('I promised to visit every friday');
  return r.due_mode === 'recurring' && r.confidence.includes('start_date_needed')
    ? true : JSON.stringify(r);
});

/* ---------- red line RL-01: no interest fields can exist ---------- */
check('RL-01 guard rejects an interest-like field', () => {
  try {
    S.assertNoRiba({ id: 'x', interest_rate: 5 });
    return 'guard failed to throw';
  } catch { return true; }
});
check('RL-01 guard rejects late_fee', () => {
  try { S.assertNoRiba({ id: 'x', late_fee_pct: 2 }); return 'guard failed to throw'; }
  catch { return true; }
});
check('RL-01 guard passes a clean commitment', () =>
  S.assertNoRiba({ id: 'x', amount_minor: 100, unit_code: 'USD' }) === true ? true : 'should pass');

/* ---------- copy linting (R-D23) ---------- */
check('lint blocks a threatening message', () =>
  S.lintMessage('Pay me or I will take you to court').clean === false ? true : 'should block');
check('lint blocks Arabic shaming', () =>
  S.lintMessage('يا كاذب ادفع').clean === false ? true : 'should block');
check('lint allows a gentle message', () =>
  S.lintMessage('Just a friendly note, no pressure at all 🌿').clean === true ? true : 'should allow');

/* ---------- lifecycle & store (uses the real IndexedDB) ---------- */
await checkAsync('store loads', async () => {
  await S.load();
  return !!S.state.settings;
});

let testId = null;
await checkAsync('create → active, with an audit event', async () => {
  const c = await S.createCommitment({
    type: 'T-01', direction: 'I_OWE', counterparty_name: '__test_person__',
    unit_code: 'USD', amount_minor: toMinor('100', 'USD'),
    description: '__selftest__', visibility: 'private'
  });
  testId = c.id;
  const ev = S.state.audit.find(a => a.entity_id === c.id);
  return c.status === 'active' && ev ? true : `status=${c.status}, audit=${!!ev}`;
});

await checkAsync('partial payment → partial status and correct remainder', async () => {
  await S.recordFulfilment(testId, toMinor('40', 'USD'));
  const c = S.commitmentOf(testId);
  return c.status === 'partial' && S.remainingMinor(c) === toMinor('60', 'USD')
    ? true : `status=${c.status}, rem=${S.remainingMinor(c)}`;
});

await checkAsync('progress percentage is integer and correct', () =>
  eq(S.progressPct(S.commitmentOf(testId)), 40));

await checkAsync('full payment → fulfilled', async () => {
  await S.recordFulfilment(testId, toMinor('60', 'USD'));
  return eq(S.commitmentOf(testId).status, 'fulfilled');
});

await checkAsync('installments always sum to the principal', async () => {
  const c = await S.createCommitment({
    type: 'T-01', direction: 'I_OWE', counterparty_name: '__test_person__',
    unit_code: 'USD', amount_minor: 10000, description: '__selftest_inst__', visibility: 'private'
  });
  const inst = await S.setInstallments(c.id, 3, S.todayISO(), 30);
  const sum = inst.reduce((s, i) => s + i.amount_minor, 0);
  await S.deleteCommitment(c.id);
  return eq(sum, 10000, 'installment sum');
});

let relId = null;
await checkAsync('release → released status with a 24h undo window (RL-10)', async () => {
  const c = await S.createCommitment({
    type: 'T-01', direction: 'OWED_TO_ME', counterparty_name: '__test_person__',
    unit_code: 'USD', amount_minor: 5000, description: '__selftest_rel__', visibility: 'private'
  });
  relId = c.id;
  const rel = await S.releaseCommitment(c.id, 'full');
  const windowMs = rel.undo_until - Date.now();
  return S.commitmentOf(c.id).status === 'released' && windowMs > 23 * 36e5 && windowMs <= 24 * 36e5
    ? true : `status=${S.commitmentOf(c.id).status}, window=${windowMs}`;
});

await checkAsync('undo release reopens the commitment', async () => {
  const rel = S.state.releases.find(r => r.commitment_id === relId && !r.undone);
  await S.undoRelease(rel.id);
  const ok = S.commitmentOf(relId).status === 'active';
  await S.deleteCommitment(relId);
  return ok ? true : 'undo did not reopen';
});

await checkAsync('reminder cap blocks a second send within 7 days (R-D20)', async () => {
  const c = await S.createCommitment({
    type: 'T-01', direction: 'OWED_TO_ME', counterparty_name: '__test_cap__',
    unit_code: 'USD', amount_minor: 1000, description: '__selftest_cap__', visibility: 'private'
  });
  const before = S.reminderAllowed(c.id).ok;
  await S.logReminder(c.id, 'counterparty', 'gentle', 'hello');
  const after = S.reminderAllowed(c.id).ok;
  await S.deleteCommitment(c.id);
  return before === true && after === false ? true : `before=${before}, after=${after}`;
});

await checkAsync('net position never sums across units (R-D03)', async () => {
  const rows = S.netPosition();
  const units = new Set(rows.map(r => r.unit));
  return units.size === rows.length ? true : 'duplicate unit rows found';
});

await checkAsync('spiritual records (T-10) stay out of the ledger (R-V03)', async () => {
  const visible = S.visibleCommitments().some(c => c.type === 'T-10');
  const exported = S.exportPayload(false).spiritual.length;
  return !visible && exported === 0 ? true : `visible=${visible}, exported=${exported}`;
});

await checkAsync('export payload excludes the PIN', () =>
  S.exportPayload(false).settings.pin === '' ? true : 'PIN leaked into export');

await checkAsync('audit hash chain verifies (R-M02)', async () => {
  const r = await db.verifyChain();
  return r.ok ? true : `${r.reason} at ${r.at}`;
});

/* clean up the test fixtures so a real ledger is not polluted */
await checkAsync('cleanup test records', async () => {
  for (const c of S.state.commitments.filter(x => (x.description || '').startsWith('__selftest'))) {
    await S.deleteCommitment(c.id);
  }
  for (const p of S.state.counterparties.filter(x => (x.alias || '').startsWith('__test'))) {
    await db.del('counterparties', p.id);
  }
  await S.load();
  return true;
});

/* ---------- staged social auth ---------- */
const b64u = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (claims) => b64u({ alg: 'none' }) + '.' + b64u(claims) + '.sig';
check('auth: decodeJwt reads claims (incl. UTF-8 names)', () => {
  const c = AUTH.decodeJwt(b64u({ alg: 'RS256' }) + '.' + btoa(unescape(encodeURIComponent(JSON.stringify({ sub: '1', name: 'سارة' })))).replace(/=+$/, '') + '.x');
  return eq(c.name, 'سارة');
});
check('auth: nonce mismatch is rejected', () =>
  eq(AUTH.checkClaims({ sub: '1', nonce: 'a', aud: 'cid' }, { nonce: 'b' }, { clientId: 'cid' }), 'nonce mismatch'));
check('auth: wrong audience is rejected', () =>
  eq(AUTH.checkClaims({ sub: '1', nonce: 'n', aud: 'other' }, { nonce: 'n' }, { clientId: 'cid' }), 'audience mismatch'));
check('auth: expired token is rejected', () =>
  eq(AUTH.checkClaims({ sub: '1', nonce: 'n', aud: 'cid', exp: 1000 }, { nonce: 'n' }, { clientId: 'cid' }), 'token expired'));
check('auth: valid claims pass', () =>
  eq(AUTH.checkClaims(AUTH.decodeJwt(jwt({ sub: '42', nonce: 'n', aud: ['cid'], exp: Date.now() / 1000 + 600 })), { nonce: 'n' }, { clientId: 'cid' }), null));
check('auth: only social providers exist (no password provider)', () =>
  eq(Object.keys(AUTH.PROVIDERS).sort().join(','), 'apple,google,microsoft'));
check('auth: export & delete are never gated (RL-09)', () =>
  !('export' in AUTH.GATED) && !('delete' in AUTH.GATED) && !('add' in AUTH.GATED) ? true : 'gated a local feature');
await checkAsync('auth: stage 1 by default, stage 2 after linking, back after sign-out', async () => {
  await S.load();
  const saved = S.state.settings.account || null;
  await S.saveSettings({ account: null });
  const a = AUTH.isSignedIn();
  await S.saveSettings({ account: { provider: 'google', sub: 't', name: 'T', expires_at: Date.now() + 1e6 } });
  const b = AUTH.isSignedIn();
  await S.saveSettings({ account: { provider: 'google', sub: 't', name: 'T', expires_at: Date.now() - 1 } });
  const c = AUTH.isSignedIn();
  await S.saveSettings({ account: saved });
  return !a && b && !c ? true : `a=${a} b=${b} c=${c}`;
});

/* ---------- request QR codes ---------- */
const samplePayload = { v: 1, k: 'confirm', f: 'سارة', r: 'I_OWE', u: 'SAR', a: 50050, d: 'Car repair — إصلاح', i: '2026-01-02', du: '2026-02-03' };
check('qr: payload round-trips through the URL encoding (incl. Arabic)', () => {
  const back = QR.decodePayload(QR.encodePayload(samplePayload));
  return JSON.stringify(back) === JSON.stringify(samplePayload) ? true : JSON.stringify(back);
});
check('qr: garbage and unknown kinds are rejected, never thrown', () =>
  QR.decodePayload('%%%') === null && QR.decodePayload('') === null &&
  QR.decodePayload(btoa(JSON.stringify({ v: 1, k: 'steal' }))) === null ? true : 'accepted bad input');
check('qr: hostile fields are clamped and typed', () => {
  const evil = { v: 1, k: 'remind', f: 'x'.repeat(500), r: 'HACK', u: '<script>', a: -5, i: 'yesterday', m: 'ok\u0000' };
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify(evil)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const o = QR.decodePayload(enc);
  return o && o.f.length === 60 && o.r === 'MUTUAL' && o.u === 'ITEM' && !('a' in o) && !('i' in o) && !/\u0000/.test(o.m) ? true : JSON.stringify(o);
});
check('qr: payload carries one request only, never the ledger (R-D11)', () => {
  const c = { direction: 'I_OWE', unit_code: 'USD', amount_minor: 1000, description: 'x', incurred_on: '2026-01-01', id: 'c1' };
  const p = QR.buildPayload('confirm', c);
  const keys = Object.keys(p).sort().join(',');
  return !/id|notes|counterparty|witness|evidence/.test(keys) ? true : keys;
});
check('qr: every request kind has a label in both languages', () =>
  QR.KINDS.every(k => QR.kindLabel(k)) ? true : 'missing');
check('qr: uses error-correction level H so the centre logo is safe', () => {
  const q = qrcode(0, 'H'); q.addData(QR.requestURL(samplePayload)); q.make();
  const n = q.getModuleCount();
  const logoArea = Math.pow(Math.max(5, Math.round(n * 0.2) | 1), 2) / (n * n);
  return logoArea < 0.15 ? true : 'logo covers ' + Math.round(logoArea * 100) + '%';
});
check('qr: canvas renders with the logo and a white quiet zone', () => {
  const cv = QR.qrCanvas('https://example.org/#/r?d=abc');
  const ctx = cv.getContext('2d');
  const corner = ctx.getImageData(2, 2, 1, 1).data;
  const mid = ctx.getImageData(cv.width / 2, cv.width / 2, 1, 1).data;
  return corner[0] === 255 && mid[0] < 60 ? true : `corner=${corner[0]} centre=${mid[0]}`;
});
check('qr: showing a QR to someone is a gated (stage 2) feature', () => 'qr' in AUTH.GATED ? true : 'not gated');

/* ---------- guide & tour content ---------- */
check('guide: every chapter has a unique id and en+ar title', () => {
  const ids = new Set(GUIDE.map(c => c.id));
  if (ids.size !== GUIDE.length) return 'duplicate chapter id';
  const bad = GUIDE.find(c => !c.title.en || !c.title.ar || !c.lead.en || !c.lead.ar);
  return bad ? 'missing text in ' + bad.id : true;
});
check('guide: glossary covers every defined term, all bilingual', () => {
  const g = glossaryEntries();
  const bad = g.find(e => !e.term.en || !e.term.ar || !e.term.fr || !e.def.en || !e.def.ar || !e.def.fr);
  return g.length >= 80 && !bad ? true : `entries=${g.length} bad=${bad && bad.term.en}`;
});
check('guide: every screen help points at a real chapter', () => {
  const ids = new Set(GUIDE.map(c => c.id));
  const bad = Object.entries(SCREEN_HELP).find(([, h]) => !ids.has(h.chapter));
  return bad ? 'bad chapter for ' + bad[0] : true;
});
check('tour: every step is bilingual and has a selector', () => {
  const steps = Object.values(TOURS).flat();
  const bad = steps.find(st => !st.sel || !st.title.en || !st.title.ar || !st.title.fr || !st.body.en || !st.body.ar || !st.body.fr);
  return steps.length >= 15 && !bad ? true : 'bad step ' + (bad && bad.sel);
});

/* ---------- amount parsing round-trips in every locale (v2.0) ---------- */
check('prefilled amount is accepted back (en, ar, fr) — regression for settlement QR', () => {
  const bad = [];
  for (const [loc, dig] of [['en', 'latn'], ['ar', 'arab'], ['fr', 'latn']]) {
    setLocale(loc); setDigits(dig);
    const v = inputValue(150000, 'SAR');
    if (toMinor(v, 'SAR') !== 150000) bad.push(loc + ':' + v);
  }
  setLocale('en'); setDigits('latn');
  return bad.length ? bad.join(' ') : true;
});
check('French grouping and decimal comma: "1 500,50" → 150050', () => {
  setLocale('fr'); const r = toMinor('1\u202F500,50', 'EUR'); setLocale('en');
  return eq(r, 150050);
});
check('mixed separators: last one is the decimal mark', () =>
  eq(toMinor('1.250,00', 'EUR') + ':' + toMinor('1,250.00', 'USD'), '125000:125000'));

/* ---------- v2.0 §1 bug fixes ---------- */
check('tour: a single missing step is dropped silently', () => {
  const out = planSteps([{ sel: 'a' }, { sel: 'b' }, { sel: 'c' }], st => st.sel !== 'b');
  return eq(out.map(x => x.sel).join(','), 'a,c');
});
check('tour: two or more missing steps are kept and flagged (never dropped silently)', () => {
  const out = planSteps([{ sel: 'a' }, { sel: 'b' }, { sel: 'c' }], st => st.sel === 'a');
  return eq(out.length + ':' + out.filter(x => x.missing).length, '3:2');
});
check('tour: onboarding has its own tour, all steps bilingual', () => {
  const st = TOURS.onboarding || [];
  return st.length >= 3 && st.every(x => x.title.en && x.title.ar && x.body.en && x.body.ar) ? true : 'missing onboarding tour';
});
check('greeting uses the ICU message greet.with_name in every locale', () => {
  setLocale('en'); const en = t('greet.with_name', { greeting: 'Good morning', name: 'Sara' });
  setLocale('ar'); const ar = t('greet.with_name', { greeting: 'صباح الخير', name: 'سارة' });
  setLocale('en');
  return en === 'Good morning, Sara' && ar === 'صباح الخير، سارة' ? true : en + ' | ' + ar;
});
check('document title comes from i18n, discreet title stays "Notes"', () => {
  setLocale('ar'); const ar = t('app.title'), d = t('app.title_discreet'); setLocale('en');
  return ar.includes('ديون') && d === 'Notes' && t('app.title_discreet') === 'Notes' ? true : ar + ' / ' + d;
});
check('auth-config: preview only on localhost', () => {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return AUTH_CONFIG.allowPreview === local ? true : 'allowPreview=' + AUTH_CONFIG.allowPreview;
});
check('tourDone() is false (not true) when nothing was recorded', () => {
  const was = S.state.settings.tour_done; S.state.settings.tour_done = false;
  const r = tourDone(); S.state.settings.tour_done = was;
  return r === false ? true : 'expected false';
});
await checkAsync('guide/tour progress lives in IndexedDB settings and survives export→import', async () => {
  await S.load();
  await S.saveProgress({ guide_read: ['start', 'words'], tour_done: true });
  const payload = S.exportPayload();
  if (!payload.settings.guide_read || payload.settings.guide_read.length !== 2) return 'not exported';
  await S.saveProgress({ guide_read: [], tour_done: false });
  await S.importPayload(payload);
  return readChapters().length === 2 && S.state.settings.tour_done === true ? true : 'not restored';
});
await checkAsync('legacy localStorage progress migrates into IndexedDB once', async () => {
  localStorage.setItem('dyon.guide.read', JSON.stringify(['money']));
  localStorage.setItem('dyon.tour.done', '1');
  await S.load();
  const ok = readChapters().includes('money') && localStorage.getItem('dyon.guide.read') === null;
  return ok ? true : 'not migrated';
});
await checkAsync('no third-party hosts in the app shell (fonts and icons self-hosted)', async () => {
  const html = await (await fetch('index.html')).text();
  return /googleapis|gstatic|jsdelivr|cdnjs|unpkg/.test(html) ? 'third-party URL in index.html' : true;
});
await checkAsync('index.html ships a Content-Security-Policy', async () => {
  const html = await (await fetch('index.html')).text();
  return /Content-Security-Policy[^>]*default-src 'self'/.test(html) ? true : 'no CSP';
});
await checkAsync('service worker VERSION is a content hash and it never skips waiting on its own', async () => {
  const sw = await (await fetch('sw.js')).text();
  const v = /const VERSION = 'dyon-([0-9a-f]{12})'/.test(sw);
  const install = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('message'"));
  return v && !/skipWaiting/.test(install) ? true : 'version=' + v;
});

await checkAsync('service worker CORE lists every module imported by app.js and every locale file', async () => {
  const sw = await (await fetch('sw.js')).text();
  const core = new Set([...sw.match(/const CORE = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']*)'/g)].map(m => m[1]));
  const seen = new Set(); const queue = ['js/app.js'];
  while (queue.length) {
    const f = queue.shift(); if (seen.has(f)) continue; seen.add(f);
    const src = await (await fetch(f)).text();
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      const rel = m[1] || m[2];
      queue.push(new URL(rel, location.origin + '/' + f).pathname.slice(1));
    }
  }
  const missing = [...seen, ...Object.keys(LOCALES).map(c => `locales/${c}.json`)].filter(f => !core.has(f));
  return missing.length ? 'missing: ' + missing.join(', ') : true;
});

/* ---------- report ---------- */
const passed = results.filter(r => r.ok).length;
const failed = results.length - passed;

const summary = document.getElementById('summary');
summary.innerHTML = '';
const h = document.createElement('h2');
h.textContent = `${passed} passed · ${failed} failed · ${results.length} total`;
h.style.color = failed ? 'var(--needs)' : 'var(--good)';
summary.appendChild(h);

const list = document.createElement('ul');
list.className = 'listy';
for (const r of results) {
  const li = document.createElement('li');
  const row = document.createElement('div');
  row.className = 'item-row';
  row.style.cursor = 'default';
  const ic = document.createElement('i');
  ic.className = r.ok ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark';
  ic.style.color = r.ok ? 'var(--good)' : 'var(--needs)';
  const main = document.createElement('span');
  main.className = 'item-main';
  const b = document.createElement('b');
  b.textContent = r.name;
  main.appendChild(b);
  if (r.detail) {
    const small = document.createElement('small');
    small.textContent = r.detail;
    main.appendChild(small);
  }
  row.append(ic, main);
  li.appendChild(row);
  list.appendChild(li);
}
document.getElementById('results').appendChild(list);
console.log(`DYON self tests: ${passed}/${results.length} passed`);
results.filter(r => !r.ok).forEach(r => console.error('FAIL:', r.name, r.detail || ''));
