/* DYON — flow & validation walker.
   For each sheet: open it, press the primary button with empty/invalid input,
   and assert that (a) nothing was saved, and (b) an error was actually shown. */

import * as S from './store.js';
import * as F from './flows.js';
import { seedDemo } from './seed.js';
import { setLocale, setDigits, setCalendars } from './i18n.js';
import { closeSheet } from './ui.js';
import * as AUTH from './auth.js';
import { ensureLocale as __ensure } from './i18n.js';
await __ensure('ar'); await __ensure('fr');


const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* Poll instead of guessing with fixed sleeps (a slow CI runner made a 60 ms
   sleep flaky). Resolves with the value, or null after `timeout`. */
async function waitFor(fn, timeout = 2000) {
  const t0 = Date.now();
  for (;;) { const v = fn(); if (v) return v; if (Date.now() - t0 > timeout) return null; await sleep(20); }
}

function panel() { return document.querySelector('.sheet'); }
function footerButtons() {
  const p = panel();
  return p ? Array.from(p.querySelectorAll('.sheet-foot .btn')) : [];
}
function primaryButton() {
  const btns = footerButtons();
  return btns.find(b => b.classList.contains('btn-primary'))
      || btns.find(b => b.classList.contains('btn-good'))
      || btns[btns.length - 1];
}
function visibleErrors() {
  const p = panel();
  if (!p) return [];
  return Array.from(p.querySelectorAll('.err, .form-summary'))
    .filter(n => n.textContent.trim().length > 0);
}
function fieldByLabel(re) {
  const p = panel();
  if (!p) return null;
  for (const lab of p.querySelectorAll('label')) {
    if (re.test(lab.textContent)) {
      const id = lab.getAttribute('for');
      if (id) return p.querySelector('#' + CSS.escape(id));
    }
  }
  return null;
}

async function expectBlocked(name, open, opts = {}) {
  const before = {
    commitments: S.state.commitments.length,
    counterparties: S.state.counterparties.length,
    fulfilments: S.state.fulfilments.length,
    respites: S.state.respites.length,
    releases: S.state.releases.length,
    disputes: S.state.disputes.length,
    settlements: S.state.settlements.length,
    witnesses: S.state.witnesses.length,
    promisesToPay: S.state.promisesToPay.length,
    transfers: S.state.transfers.length,
    spiritual: S.state.spiritual.length
  };
  try {
    open();
    await sleep(60);
    if (!panel()) { results.push({ name, ok: false, detail: 'sheet did not open' }); return; }
    if (opts.prepare) opts.prepare();

    const btn = primaryButton();
    if (!btn) { results.push({ name, ok: false, detail: 'no primary button' }); closeSheet(true); return; }

    const wasDisabled = btn.disabled;
    btn.disabled = false;      // force the click through to test the guard, not the disabled state
    btn.click();
    await sleep(120);

    const stillOpen = !!panel();
    const errs = visibleErrors();
    const after = {
      commitments: S.state.commitments.length,
      counterparties: S.state.counterparties.length,
      fulfilments: S.state.fulfilments.length,
      respites: S.state.respites.length,
      releases: S.state.releases.length,
      disputes: S.state.disputes.length,
      settlements: S.state.settlements.length,
      witnesses: S.state.witnesses.length,
      promisesToPay: S.state.promisesToPay.length,
      transfers: S.state.transfers.length,
      spiritual: S.state.spiritual.length
    };
    const wrote = Object.keys(before).filter(k => after[k] !== before[k]);

    closeSheet(true);
    await sleep(40);

    if (wrote.length) {
      results.push({ name, ok: false, detail: 'SAVED INVALID DATA into: ' + wrote.join(', ') });
    } else if (!stillOpen) {
      results.push({ name, ok: false, detail: 'sheet closed without saving or explaining' });
    } else if (!errs.length && !wasDisabled) {
      results.push({ name, ok: false, detail: 'blocked but showed no message' });
    } else {
      results.push({
        name, ok: true,
        detail: wasDisabled && !errs.length
          ? 'guarded by a disabled confirm control'
          : errs[0].textContent.trim().slice(0, 90)
      });
    }
  } catch (e) {
    closeSheet(true);
    results.push({ name, ok: false, detail: 'threw: ' + e.message });
  }
}

/* A sheet that SHOULD accept good input and write exactly one record. */
async function expectAccepted(name, open, fill, countKey) {
  const before = S.state[countKey].length;
  try {
    open();
    await sleep(60);
    if (!panel()) { results.push({ name, ok: false, detail: 'sheet did not open' }); return; }
    fill();
    const btn = primaryButton();
    btn.disabled = false;
    btn.click();
    await sleep(260);
    closeSheet(true);
    await sleep(40);
    const after = S.state[countKey].length;
    results.push(after === before + 1
      ? { name, ok: true, detail: `${countKey} ${before} → ${after}` }
      : { name, ok: false, detail: `expected ${countKey} +1, got ${before} → ${after}` });
  } catch (e) {
    closeSheet(true);
    results.push({ name, ok: false, detail: 'threw: ' + e.message });
  }
}

async function main() {
  await S.load();
  if (!S.visibleCommitments().length) await seedDemo();
  await S.load();
  setLocale('en'); setDigits('latn'); setCalendars('gregory', 'none');

  const open = S.openCommitments();
  const owe = open.find(c => c.direction === 'I_OWE' && c.amount_minor) || open[0];
  const owed = open.find(c => c.direction === 'OWED_TO_ME' && c.amount_minor) || open[0];

  /* ---- staged auth: gated flows must ask for sign-in first ---- */
  const savedAccount = S.state.settings.account || null;
  await S.saveSettings({ account: null });
  F.openShare(owe.id);
  await sleep(60);
  {
    const p = panel();
    const social = p ? p.querySelectorAll('[data-provider]').length : 0;
    const pw = p ? p.querySelectorAll('input[type="password"]').length : 0;
    results.push(social >= 3 && pw === 0
      ? { name: 'Auth gate: Share while signed out asks for social sign-in only', ok: true, detail: `${social} providers, no password field` }
      : { name: 'Auth gate: Share while signed out asks for social sign-in only', ok: false, detail: `providers=${social} passwords=${pw}` });
    closeSheet(true); await sleep(30);
  }
  F.openRecordPayment(owe.id);
  await sleep(60);
  results.push(panel() && !panel().querySelector('[data-provider]')
    ? { name: 'Auth gate: local actions (record payment) never ask for an account', ok: true, detail: 'opened directly' }
    : { name: 'Auth gate: local actions (record payment) never ask for an account', ok: false, detail: 'sign-in shown' });
  closeSheet(true); await sleep(30);
  F.openShare(owe.id); await sleep(60);
  const pv = panel() && panel().querySelector('[data-provider="google"]');
  if (pv) { pv.click(); await sleep(300); }
  results.push(AUTH.isSignedIn() && panel() && /share|مشاركة/i.test(panel().getAttribute('aria-label') || '')
    ? { name: 'Auth gate: after sign-in the original action resumes', ok: true, detail: 'share sheet opened' }
    : { name: 'Auth gate: after sign-in the original action resumes', ok: false, detail: 'signed=' + AUTH.isSignedIn() });
  closeSheet(true); await sleep(30);

  /* ---- QR codes on request sheets ---- */
  for (const [label, open] of [
    ['Share for confirmation', () => F.openShare(owe.id)],
    ['Reminder', () => F.openReminder(owed.id)],
    ['Request respite', () => F.openRequestRespite(owe.id)],
    ['Settlement', () => F.openSettlement(owe.id)]
  ]) {
    open();
    const btn = await waitFor(() => panel() && panel().querySelector('[data-qr]'));
    if (btn) btn.click();
    const cv = await waitFor(() => { const c = panel() && panel().querySelector('canvas.qr-canvas'); return c && c.width > 200 ? c : null; });
    results.push(cv && cv.width > 200
      ? { name: `QR: ${label} can be shown as a QR code with the DYON logo`, ok: true, detail: cv.dataset.modules + ' modules' }
      : { name: `QR: ${label} can be shown as a QR code with the DYON logo`, ok: false, detail: btn ? 'no canvas' : 'no QR button' });
    closeSheet(true); await sleep(30);
  }

  /* ---- dependent fields in Quick Add ---- */
  F.openQuickAdd(); await sleep(60);
  {
    const p = panel();
    const unit = fieldByLabel(/^Unit/);
    const amt = fieldByLabel(/^Amount/);
    const amtHiddenForMoney = amt.closest('.field').hidden;
    unit.value = 'PROMISE'; unit.dispatchEvent(new Event('change'));
    const amtHiddenForPromise = amt.closest('.field').hidden;
    const due = fieldByLabel(/^Due$/);
    const dueHiddenByDefault = due.closest('.field').hidden;
    const wit = fieldByLabel(/^Witnesses/);
    const witHidden = wit.closest('.field').hidden;
    const ok = !amtHiddenForMoney && amtHiddenForPromise && dueHiddenByDefault && witHidden;
    results.push({ name: 'Quick Add: dependent fields appear only when their parent answer needs them', ok,
      detail: `amount(money)=${!amtHiddenForMoney} amount(promise)=${!amtHiddenForPromise} due-date=${!dueHiddenByDefault} witnesses=${!witHidden}` });
    closeSheet(true); await sleep(30);
  }

  /* ---- invalid submissions must be refused ---- */
  await expectBlocked('Quick Add: empty form is refused', () => F.openQuickAdd());

  await expectBlocked('Quick Add: name given but no amount is refused', () => F.openQuickAdd(), {
    prepare: () => {
      const who = fieldByLabel(/^Who/);
      if (who) { who.value = '__flowtest__'; }
    }
  });

  await expectBlocked('Quick Add: letters in the amount are refused', () => F.openQuickAdd(), {
    prepare: () => {
      const who = fieldByLabel(/^Who/);
      const amt = fieldByLabel(/^Amount/);
      if (who) who.value = '__flowtest__';
      if (amt) amt.value = 'abc';
    }
  });

  await expectBlocked('Record payment: amount above the remainder is refused',
    () => F.openRecordPayment(owe.id), {
      prepare: () => {
        const amt = fieldByLabel(/^Amount fulfilled/);
        if (amt) amt.value = '999999999';
      }
    });

  await expectBlocked('Record payment: zero is refused', () => F.openRecordPayment(owe.id), {
    prepare: () => { const amt = fieldByLabel(/^Amount fulfilled/); if (amt) amt.value = '0'; }
  });

  await expectBlocked('Promise to pay: a past date is refused', () => F.openPromiseToPay(owe.id), {
    prepare: () => { const d = fieldByLabel(/^By/); if (d) d.value = '2020-01-01'; }
  });

  await expectBlocked('Request respite: a past date is refused', () => F.openRequestRespite(owe.id), {
    prepare: () => { const d = fieldByLabel(/Proposed new date/); if (d) d.value = '2020-01-01'; }
  });

  await expectBlocked('Grant respite: a past date is refused', () => F.openGrantRespite(owed.id), {
    prepare: () => { const d = fieldByLabel(/Proposed new date/); if (d) d.value = '2020-01-01'; }
  });

  await expectBlocked('Release: confirm is gated until acknowledged (RL-10)',
    () => F.openRelease(owed.id));

  await expectBlocked('Dispute: an empty claim is refused', () => F.openDispute(owe.id));

  await expectBlocked('Settlement: a unit change without a rate is refused',
    () => F.openSettlement(owe.id), {
      prepare: () => {
        const sel = fieldByLabel(/^Unit/);
        if (sel) { sel.value = sel.value === 'USD' ? 'EUR' : 'USD'; sel.dispatchEvent(new Event('change')); }
      }
    });

  await expectBlocked('Settlement: a zero amount is refused', () => F.openSettlement(owe.id), {
    prepare: () => { const amt = fieldByLabel(/New amount/); if (amt) amt.value = '0'; }
  });

  await expectBlocked('Transfer: missing consent is refused', () => F.openTransfer(owed.id), {
    prepare: () => { const to = fieldByLabel(/Transfer to/); if (to) to.value = '__flowtest_hawala__'; }
  });

  await expectBlocked('Transfer: consent without a name is refused', () => F.openTransfer(owed.id), {
    prepare: () => {
      panel().querySelectorAll('input[type="checkbox"]').forEach(c => {
        c.checked = true; c.dispatchEvent(new Event('change'));
      });
    }
  });

  await expectBlocked('Counterparty: an empty name is refused', () => F.openCounterparty());

  await expectBlocked('Counterparty: a duplicate name is refused', () => F.openCounterparty(), {
    prepare: () => {
      const n = fieldByLabel(/^Who/);
      const existing = S.state.counterparties[0];
      if (n && existing) n.value = existing.alias;
    }
  });

  await expectBlocked('Self reminder: a past date is refused', () => F.openSelfReminder(owe.id), {
    prepare: () => { const d = fieldByLabel(/Remind me on/); if (d) d.value = '2020-01-01'; }
  });

  /* ---- valid submissions must go through ---- */
  await expectAccepted('Quick Add: a valid entry saves', () => F.openQuickAdd(), () => {
    fieldByLabel(/^Who/).value = '__flowtest_ok__';
    fieldByLabel(/^Amount/).value = '125.50';
    fieldByLabel(/^Description/).value = '__flowtest_ok_desc__';
  }, 'commitments');

  const made = S.state.commitments.find(c => c.description === '__flowtest_ok_desc__');
  results.push(made && made.amount_minor === 12550
    ? { name: 'Quick Add stored exact integer minor units', ok: true, detail: 'amount_minor=12550' }
    : { name: 'Quick Add stored exact integer minor units', ok: false,
        detail: 'got ' + (made && made.amount_minor) });

  if (made) {
    await expectAccepted('Record payment: a valid partial saves',
      () => F.openRecordPayment(made.id),
      () => { fieldByLabel(/^Amount fulfilled/).value = '25.50'; },
      'fulfilments');

    const rem = S.remainingMinor(S.commitmentOf(made.id));
    results.push(rem === 10000
      ? { name: 'Remaining balance is exact after a partial payment', ok: true, detail: 'remaining=10000' }
      : { name: 'Remaining balance is exact after a partial payment', ok: false, detail: 'got ' + rem });

    await expectBlocked('Edit: letters in the amount are refused', () => F.openEdit(made.id), {
      prepare: () => { const a = fieldByLabel(/^Amount/); if (a) a.value = 'xyz'; }
    });

    await expectBlocked('Edit: a future "date incurred" is refused', () => F.openEdit(made.id), {
      prepare: () => {
        const d = fieldByLabel(/Date incurred/);
        if (d) { const f = new Date(); f.setDate(f.getDate() + 10); d.value = f.toISOString().slice(0, 10); }
      }
    });
  }

  /* cleanup */
  await S.saveSettings({ account: savedAccount });
  for (const c of S.state.commitments.filter(x => (x.description || '').startsWith('__flowtest'))) {
    await S.deleteCommitment(c.id);
  }
  await S.load();

  report();
}

function report() {
  const real = results;
  const passed = real.filter(r => r.ok).length;
  const failed = real.length - passed;
  const summary = document.getElementById('summary');
  summary.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = `${passed} passed · ${failed} failed · ${real.length} checks`;
  h.style.color = failed ? 'var(--needs)' : 'var(--good)';
  summary.appendChild(h);

  const list = document.createElement('ul');
  list.className = 'listy';
  for (const r of real) {
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
    const small = document.createElement('small');
    small.textContent = r.detail || '';
    main.append(b, small);
    row.append(ic, main);
    li.appendChild(row);
    list.appendChild(li);
  }
  document.getElementById('results').replaceChildren(list);
  console.log(`DYON flow check: ${passed}/${real.length}`);
  real.filter(r => !r.ok).forEach(r => console.error('FLOW FAIL:', r.name, r.detail));
}

main().catch(e => {
  document.getElementById('summary').textContent = 'Harness error: ' + e.message;
  console.error(e);
});
