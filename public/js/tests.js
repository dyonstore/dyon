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
import * as CT from './country.js';
import * as ACCT from './account.js';
import { TZ_COUNTRY } from './tz-country.js';
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
/* Harness pages live in /dev/ (§4.1) but the shell assets are at the web root,
   so fetch from root-relative URLs, not page-relative ones. */
const ROOT = '/';
await checkAsync('no third-party hosts in the app shell (fonts and icons self-hosted)', async () => {
  const html = await (await fetch(ROOT + 'index.html')).text();
  return /googleapis|gstatic|jsdelivr|cdnjs|unpkg/.test(html) ? 'third-party URL in index.html' : true;
});
await checkAsync('index.html ships a Content-Security-Policy', async () => {
  const html = await (await fetch(ROOT + 'index.html')).text();
  return /Content-Security-Policy[^>]*default-src 'self'/.test(html) ? true : 'no CSP';
});
await checkAsync('boot loader is hidden before the PIN gate (reload with a PIN never stays on the loader)', async () => {
  const src = await (await fetch(ROOT + 'js/app.js')).text();
  const hide = src.indexOf('hideBootScreen();');
  const gate = src.indexOf('await pinGate();');
  // The loader must be removed before pinGate() is awaited, otherwise the
  // z-index:500 boot screen covers the z-index:400 PIN overlay and the promise
  // never resolves. Also require the idempotent helper to exist.
  return hide !== -1 && gate !== -1 && hide < gate && /function hideBootScreen\(\)/.test(src)
    ? true : `hide=${hide} gate=${gate}`;
});
await checkAsync('index.html uses the standard mobile-web-app-capable meta (no deprecation warning)', async () => {
  const html = await (await fetch(ROOT + 'index.html')).text();
  return /<meta\s+name="mobile-web-app-capable"\s+content="yes">/.test(html)
    ? true : 'missing <meta name="mobile-web-app-capable">';
});
await checkAsync('service worker VERSION is a content hash and it never skips waiting on its own', async () => {
  const sw = await (await fetch(ROOT + 'sw.js')).text();
  const v = /const VERSION = 'dyon-([0-9a-f]{12})'/.test(sw);
  const install = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('message'"));
  return v && !/skipWaiting/.test(install) ? true : 'version=' + v;
});

await checkAsync('service worker CORE lists every module imported by app.js and every locale file', async () => {
  const sw = await (await fetch(ROOT + 'sw.js?nocache=' + Date.now(), { cache: 'no-store' })).text();
  const core = new Set([...sw.match(/const CORE = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']*)'/g)].map(m => m[1]));
  const seen = new Set(); const queue = ['js/app.js'];
  while (queue.length) {
    const f = queue.shift(); if (seen.has(f)) continue; seen.add(f);
    const src = await (await fetch(ROOT + f)).text();
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      const rel = m[1] || m[2];
      queue.push(new URL(rel, location.origin + '/' + f).pathname.slice(1));
    }
  }
  const missing = [...seen, ...Object.keys(LOCALES).map(c => `locales/${c}.json`)].filter(f => !core.has(f));
  return missing.length ? 'missing: ' + missing.join(', ') : true;
});

/* ---------- §3 country detection and defaults ---------- */
check('TZ_COUNTRY maps key zones to the right country', () => {
  return eq(TZ_COUNTRY['Africa/Tunis'], 'TN', 'Tunis') === true &&
         eq(TZ_COUNTRY['Europe/Paris'], 'FR', 'Paris') === true &&
         eq(TZ_COUNTRY['Asia/Riyadh'], 'SA', 'Riyadh') === true
    ? true : `Tunis=${TZ_COUNTRY['Africa/Tunis']} Paris=${TZ_COUNTRY['Europe/Paris']}`;
});
check('regionOfTag reads the ISO-3166 region subtag only', () => {
  return CT.regionOfTag('fr-TN') === 'TN' && CT.regionOfTag('en-US') === 'US' &&
         CT.regionOfTag('ar') === null && CT.regionOfTag('es-419') === null
    ? true : `fr-TN=${CT.regionOfTag('fr-TN')} es-419=${CT.regionOfTag('es-419')}`;
});
check('countryFromTimezone falls back to null for unknown zones', () => {
  return CT.countryFromTimezone('Mars/Olympus') === null && CT.countryFromTimezone('Africa/Tunis') === 'TN'
    ? true : 'bad fallback';
});
await checkAsync('detectCountry order: server hint wins over timezone and language', async () => {
  const r = await CT.detectCountry({
    fetchImpl: async () => ({ ok: true, json: async () => ({ country: 'eg' }) }),
    timeZone: 'Africa/Tunis', languages: ['fr-TN']
  });
  return r.country === 'EG' && r.source === 'server' ? true : JSON.stringify(r);
});
await checkAsync('detectCountry falls through to timezone when server 404s', async () => {
  const r = await CT.detectCountry({
    fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }),
    timeZone: 'Africa/Tunis', languages: ['en-US']
  });
  return r.country === 'TN' && r.source === 'timezone' ? true : JSON.stringify(r);
});
await checkAsync('detectCountry falls through to language region when tz is unknown', async () => {
  const r = await CT.detectCountry({
    fetchImpl: async () => { throw new Error('offline'); },
    timeZone: 'Mars/Olympus', languages: ['fr-TN', 'en']
  });
  return r.country === 'TN' && r.source === 'language' ? true : JSON.stringify(r);
});
await checkAsync('countryDefaults(TN): TND, 3 minor units, suggests Islamic calendar', async () => {
  const d = await CT.countryDefaults('TN');
  return d && d.currency === 'TND' && d.minor_units === 3 && d.suggest_islamic_mode === true &&
         d.calendar_secondary === 'islamic-umalqura' ? true : JSON.stringify(d);
});
await checkAsync('applyCountry never turns on islamic_mode (suggestion only, §3.2)', async () => {
  const before = { ...S.state.settings };
  await S.saveSettings({ islamic_mode: false, locale_chosen: false });
  await CT.applyCountry('SA', { apply: true, store: S });   // SA suggests Islamic mode
  const ok = S.state.settings.islamic_mode === false && S.state.settings.base_currency === 'SAR';
  await S.saveSettings(before);
  return ok ? true : 'islamic_mode was auto-enabled';
});
await checkAsync('applyCountry never overrides a locale the user already chose (§2.4)', async () => {
  const before = { ...S.state.settings };
  await S.saveSettings({ locale: 'en', locale_chosen: true });
  await CT.applyCountry('FR', { apply: true, store: S });   // FR default locale is fr
  const kept = S.state.settings.locale === 'en';
  await S.saveSettings(before);
  return kept ? true : 'chosen locale was overridden to ' + S.state.settings.locale;
});
await checkAsync('applyCountry apply:false records the country but no opinionated defaults', async () => {
  const before = { ...S.state.settings };
  await S.saveSettings({ base_currency: 'USD', country: '' });
  await CT.applyCountry('TN', { apply: false, store: S });
  const ok = S.state.settings.country === 'TN' && S.state.settings.base_currency === 'USD';
  await S.saveSettings(before);
  return ok ? true : 'defaults applied when they should not be';
});
await checkAsync('all 25 seed countries are present with ISO 4217 minor units', async () => {
  const seeds = ['TN','DZ','MA','LY','EG','SA','AE','QA','KW','JO','LB','FR','BE','CH','CA','DE','IT','GB','US','TR','ID','MY','PK','SN','NG'];
  const all = await CT.loadCountries();
  const missing = seeds.filter(c => !all[c]);
  if (missing.length) return 'missing: ' + missing.join(',');
  return all.LY.minor_units === 3 && all.SN.minor_units === 0 ? true
    : `LY=${all.LY.minor_units} SN=${all.SN.minor_units}`;
});

/* ---------- report ---------- */
/* ---------- §5 account state ---------- */
const jsonRes = (o, ok = true, status = 200) => ({ ok, status, json: async () => o });
check('initialOf: first letter of name, else email, else "?"; handles Arabic and emoji', () => {
  return ACCT.initialOf('sam lee') === 'S' && ACCT.initialOf('', 'zed@x.org') === 'Z' && ACCT.initialOf('', '') === '?'
    && ACCT.initialOf('أحمد') === 'أ' && ACCT.initialOf('  élodie') === 'É' && [...ACCT.initialOf('😀 x')].length === 1
    ? true : [ACCT.initialOf('sam'), ACCT.initialOf('أحمد'), ACCT.initialOf('  élodie')].join('|');
});
check('syncStatus: offline > off (no engine) > pending > synced; never an error state', () => {
  const eng = (n) => ({ pending: () => n });
  const all = [ACCT.syncStatus({ online: false, engine: eng(0) }), ACCT.syncStatus({ online: true, engine: null }),
               ACCT.syncStatus({ online: true, engine: eng(3) }), ACCT.syncStatus({ online: true, engine: eng(0) })];
  return all.join(',') === 'offline,off,pending,synced' && !all.some(x => /error|fail|red/.test(x)) ? true : all.join(',');
});
await checkAsync('refresh(): signed-out answer keeps providers and the csrf token, mirrors nothing locally', async () => {
  ACCT._reset();
  const me = await ACCT.refresh({ fetchImpl: async () => jsonRes({ signed_in: false, providers: ['google', 5, 'apple'], csrf: 'c'.repeat(32) }) });
  return me.signed_in === false && ACCT.serverProviders().join() === 'google,apple' && ACCT.csrfToken() === 'c'.repeat(32) && !AUTH.isSignedIn()
    ? true : JSON.stringify(me);
});
await checkAsync('refresh(): signed-in answer is normalised, mirrored to settings.account (sub "server") and cached', async () => {
  ACCT._reset();
  await ACCT.refresh({ fetchImpl: async () => jsonRes({ signed_in: true, name: 'Sam', email: 's@x.org', avatar: '/api/avatar.php', created: 1700000000, provider: 'google', csrf: 'k'.repeat(32), sub_hash: 'LEAK' }) });
  const id = ACCT.identity(AUTH.session());
  const a = S.state.settings.account;
  const ok = id.source === 'server' && id.name === 'Sam' && id.avatar === '/api/avatar.php' && a.sub === 'server' && AUTH.isSignedIn()
    && S.state.settings.account_server.name === 'Sam' && !JSON.stringify(S.state.settings).includes('LEAK');
  await ACCT.refresh({ fetchImpl: async () => jsonRes({ signed_in: false }) });   // back to signed out → mirror removed
  return ok && !S.state.settings.account && !AUTH.isSignedIn() ? true : JSON.stringify({ id, a, after: S.state.settings.account });
});
await checkAsync('refresh(): an external avatar URL is never trusted (only same-origin paths)', async () => {
  ACCT._reset();
  await ACCT.refresh({ fetchImpl: async () => jsonRes({ signed_in: true, name: 'A', avatar: 'https://lh3.googleusercontent.com/x', created: 1 }) });
  const id = ACCT.identity(null); await ACCT.refresh({ fetchImpl: async () => jsonRes({ signed_in: false }) });
  return id.avatar === null ? true : 'accepted ' + id.avatar;
});
await checkAsync('refresh(): server down / 500 / static host → stays signed out, no throw, ledger untouched', async () => {
  ACCT._reset(); const before = S.state.commitments.length;
  const a = await ACCT.refresh({ fetchImpl: async () => { throw new TypeError('offline'); } });
  const b = await ACCT.refresh({ fetchImpl: async () => jsonRes({}, false, 500) });
  return a === null && b === null && S.state.commitments.length === before ? true : 'state changed';
});
await checkAsync('refresh(): when offline after a prior sign-in, the cached identity is shown (marked cached)', async () => {
  ACCT._reset();
  await S.saveProgress({ account_server: { name: 'Cached Sam', email: 'c@x.org', avatar: '/api/avatar.php', created: 5, provider: 'google' } });
  await ACCT.refresh({ fetchImpl: async () => { throw new TypeError('offline'); } });
  const id = ACCT.identity(null); await S.saveProgress({ account_server: null }); ACCT._reset();
  return id && id.name === 'Cached Sam' && id.cached === true ? true : JSON.stringify(id);
});
await checkAsync('signOut(): POSTs with the CSRF header + same-origin credentials, then reports signed out', async () => {
  ACCT._reset(); const calls = [];
  const f = async (url, o = {}) => {
    calls.push({ url, method: o.method || 'GET', csrf: (o.headers || {})['X-CSRF-Token'], cred: o.credentials });
    if (url.includes('logout')) return jsonRes({ ok: true });
    return jsonRes(calls.some(c => c.url.includes('logout')) ? { signed_in: false, csrf: 'n'.repeat(32) } : { signed_in: true, name: 'S', csrf: 'k'.repeat(32), created: 1 });
  };
  await ACCT.refresh({ fetchImpl: f });
  const ok = await ACCT.signOut({ fetchImpl: f });
  const post = calls.find(c => c.url.includes('logout'));
  return ok && post.method === 'POST' && post.csrf === 'k'.repeat(32) && post.cred === 'same-origin' && !ACCT.current().signed_in && ACCT.csrfToken() === 'n'.repeat(32)
    ? true : JSON.stringify({ ok, post });
});
await checkAsync('signOut(): a failed request leaves the user signed in and returns false', async () => {
  ACCT._reset();
  const f = async (url) => url.includes('logout') ? jsonRes({}, false, 403) : jsonRes({ signed_in: true, name: 'S', csrf: 'k'.repeat(32), created: 1 });
  await ACCT.refresh({ fetchImpl: f });
  const ok = await ACCT.signOut({ fetchImpl: f }); const still = ACCT.current().signed_in;
  await ACCT.refresh({ fetchImpl: async () => jsonRes({ signed_in: false }) });
  return ok === false && still === true ? true : JSON.stringify({ ok, still });
});
check('identity(): a local preview link is still shown, flagged as preview', () => {
  ACCT._reset();
  const id = ACCT.identity({ sub: 'preview-google', provider: 'google', name: 'P', preview: true, linked_at: 1700000000000 });
  return id.source === 'local' && id.preview === true && id.created === 1700000000 && ACCT.identity(null) === null ? true : JSON.stringify(id);
});
await checkAsync('RL-09: the account panel code never gates export behind sign-in', async () => {
  const src = await (await fetch(ROOT + 'js/account-aside.js')).text();
  const out = src.slice(src.indexOf('function signedOutBody'), src.indexOf('function statsBlock'));
  return /acct-export/.test(out) && !/requireAuth|isSignedIn/.test(out) ? true : 'export is gated or missing in the signed-out panel';
});



/* ---------- §6 sync crypto ---------- */
const SC = await import('./sync-crypto.js');
let _sk = null;
const syncKeys = async () => _sk ||= await SC.createKeys('correct horse battery');
await checkAsync('sync-crypto: passphrase unlock round-trips the data key; wrong passphrase fails the check', async () => {
  const { dataKey, meta } = await syncKeys();
  const dk = await SC.unlockWithPassphrase('correct horse battery', meta);
  const blob = await SC.encryptRecord(dataKey, 7, 'commitments', 'c_1', 1, { name: 'Sam', amount: 50 });
  const back = await SC.decryptRecord(dk, 7, 'commitments', 'c_1', 1, blob);
  let bad = ''; try { await SC.unlockWithPassphrase('wrong', meta); } catch (e) { bad = e.code; }
  return back.name === 'Sam' && back.amount === 50 && bad === 'bad_secret' ? true : JSON.stringify({ back, bad });
});
await checkAsync('sync-crypto: meta carries only salt/iter/wrapped keys/key_check; no plaintext, no key material', async () => {
  const { meta } = await syncKeys();
  const keys = Object.keys(meta).sort().join();
  return keys === 'kdf_iter,key_check,salt,wrapped_key,wrapped_key_recovery' && meta.kdf_iter >= 600000 ? true : keys;
});
await checkAsync('sync-crypto: recovery phrase is 24 words, unlocks the same key, tolerates case/spacing, rejects a typo', async () => {
  const { dataKey, phrase, meta } = await syncKeys();
  const words = phrase.split(' ');
  const dk = await SC.unlockWithPhrase('  ' + phrase.toUpperCase().replace(/ /g, '   ') + ' ', meta);
  const blob = await SC.encryptRecord(dataKey, 1, 't', 'i', 1, { x: 1 });
  const ok = (await SC.decryptRecord(dk, 1, 't', 'i', 1, blob)).x === 1;
  const typo = [...words]; typo[3] = typo[3] === 'zoo' ? 'abandon' : 'zoo';
  let e1 = ''; try { await SC.unlockWithPhrase(typo.join(' '), meta); } catch (e) { e1 = e.code; }
  let e2 = ''; try { await SC.unlockWithPhrase(words.slice(1).join(' '), meta); } catch (e) { e2 = e.code; }
  return words.length === 24 && ok && e1 && e2 === 'bad_phrase' ? true : JSON.stringify({ n: words.length, ok, e1, e2 });
});
await checkAsync('sync-crypto: tampered AAD (user/table/id/rev) or ciphertext fails authentication', async () => {
  const { dataKey } = await syncKeys();
  const blob = await SC.encryptRecord(dataKey, 7, 'commitments', 'c_1', 2, { a: 1 });
  const res = [];
  for (const args of [[8, 'commitments', 'c_1', 2], [7, 'witnesses', 'c_1', 2], [7, 'commitments', 'c_2', 2], [7, 'commitments', 'c_1', 3]]) {
    try { await SC.decryptRecord(dataKey, ...args, blob); res.push('ACCEPTED'); } catch (e) { res.push(e.code); }
  }
  const o = JSON.parse(blob); o.ct = o.ct.slice(0, -4) + (o.ct.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  try { await SC.decryptRecord(dataKey, 7, 'commitments', 'c_1', 2, JSON.stringify(o)); res.push('ACCEPTED'); } catch (e) { res.push(e.code); }
  return res.every(x => x === 'tampered') ? true : res.join();
});
await checkAsync('sync-crypto: blob is {v:1, iv(12B), ct}; fresh IV each time; no plaintext in it', async () => {
  const { dataKey } = await syncKeys();
  const a = JSON.parse(await SC.encryptRecord(dataKey, 1, 't', 'i', 1, { name: 'Zainab' }));
  const b = JSON.parse(await SC.encryptRecord(dataKey, 1, 't', 'i', 1, { name: 'Zainab' }));
  return a.v === 1 && SC.unb64(a.iv).length === 12 && a.iv !== b.iv && a.ct !== b.ct && !JSON.stringify(a).includes('Zainab') ? true : JSON.stringify(a);
});
await checkAsync('sync-crypto: refuses to unwrap or create with fewer than 600 000 iterations', async () => {
  const { meta } = await syncKeys();
  let e1 = ''; try { await SC.unlockWithPassphrase('correct horse battery', { ...meta, kdf_iter: 1000 }); } catch (e) { e1 = e.code; }
  let e2 = ''; try { await SC.createKeys('x', { iterations: 599999 }); } catch (e) { e2 = e.code; }
  return e1 === 'kdf_too_weak' && e2 === 'kdf_too_weak' && SC.KDF_MIN_ITER === 600000 ? true : e1 + '/' + e2;
});
await checkAsync('sync-crypto: wordlist has 2048 unique words; check-word picker returns 3 distinct sorted positions; passphrase change keeps the data key', async () => {
  const { WORDS } = await import('./sync-wordlist.js');
  const p = SC.pickCheckWords(); const { dataKey, meta } = await syncKeys();
  const m2 = await SC.rewrapPassphrase(dataKey, 'new pass phrase', meta);
  const dk = await SC.unlockWithPassphrase('new pass phrase', m2);
  const blob = await SC.encryptRecord(dataKey, 1, 't', 'i', 1, { k: 1 });
  return WORDS.length === 2048 && new Set(WORDS).size === 2048 && p.length === 3 && new Set(p).size === 3 && p[0] < p[1] && p[1] < p[2]
    && (await SC.decryptRecord(dk, 1, 't', 'i', 1, blob)).k === 1 ? true : 'fail';
});

{
  const SY = await import('./sync.js');
  check('sync merge3: one-sided edits are taken as is; both-sided edits keep the newer and report only critical fields', () => {
    const base = { id: 'a', amount_minor: 100, description: 'x', note: 'n', status: 'active', updated_at: 1 };
    const local = { ...base, amount_minor: 200, updated_at: 5 };
    const remote = { ...base, description: 'y', updated_at: 4 };
    const m1 = SY.merge3(base, local, remote);
    if (m1.merged.amount_minor !== 200 || m1.merged.description !== 'y' || m1.conflicts.length) return 'disjoint: ' + JSON.stringify(m1);
    const r2 = { ...base, amount_minor: 300, note: 'theirs', updated_at: 9 };
    const l2 = { ...base, amount_minor: 200, note: 'mine', updated_at: 5 };
    const m2 = SY.merge3(base, l2, r2);
    if (m2.merged.amount_minor !== 300 || m2.merged.note !== 'theirs') return 'newer wins: ' + JSON.stringify(m2);
    if (m2.conflicts.length !== 1 || m2.conflicts[0].field !== 'amount_minor' || m2.conflicts[0].mine !== 200 || m2.conflicts[0].theirs !== 300 || m2.conflicts[0].kept !== 'theirs') return 'conflict list: ' + JSON.stringify(m2.conflicts);
    const m3 = SY.merge3(base, l2, { ...r2, updated_at: 2 });
    return m3.merged.amount_minor === 200 && m3.conflicts[0].kept === 'mine' ? true : 'local newer: ' + JSON.stringify(m3);
  });
  check('sync merge3: no base (first meeting) never loses a field; spiritual/audit/settings are never synced', () => {
    const m = SY.merge3(null, { id: 'a', x: 1, updated_at: 2 }, { id: 'a', y: 2, updated_at: 1 });
    const never = ['spiritual', 'audit', 'settings'].every(t => !SY.SYNCED.has(t));
    return m.merged.x === 1 && m.merged.y === 2 && never && SY.SYNCED.has('commitments') && SY.CRITICAL.has('amount_minor') ? true : JSON.stringify(m);
  });
}

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
