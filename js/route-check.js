/* DYON — route walker. Renders every view against the seeded demo ledger and
   reports: did it throw, and did it actually produce content? */

import * as S from './store.js';
import * as V from './views.js';
import * as V2 from './views2.js';
import { seedDemo } from './seed.js';
import { renderGuide } from './guide.js';
import * as QR from './qr.js';
import { GUIDE } from './guide-content.js';
import { setLocale, setDigits, setCalendars, getDir } from './i18n.js';
import { ensureLocale as __ensure } from './i18n.js';
await __ensure('ar'); await __ensure('fr');


const ctx = {
  applyLocale() {}, applyTheme() {}, rerender() {}, refreshHeader() {},
  promptInstall() {}, seed() {}
};

const ROUTES = [
  ['', () => V.renderOverview()],
  ['ledger', () => V.renderLedger(new URLSearchParams())],
  ['ledger?dir=I_OWE', () => V.renderLedger(new URLSearchParams('dir=I_OWE'))],
  ['ledger?closed=1', () => V.renderLedger(new URLSearchParams('closed=1'))],
  ['ledger?filter=no_due', () => V.renderLedger(new URLSearchParams('filter=no_due'))],
  ['ledger?unit=SAR', () => V.renderLedger(new URLSearchParams('unit=SAR'))],
  ['people', () => V.renderPeople(new URLSearchParams())],
  ['people?id=<first>', () => {
    const id = S.state.counterparties[0] && S.state.counterparties[0].id;
    return V.renderPeople(new URLSearchParams('id=' + id));
  }],
  ['people?id=missing', () => V.renderPeople(new URLSearchParams('id=nope'))],
  ['promises', () => V2.renderPromises()],
  ['services', () => V2.renderServices()],
  ['trusts', () => V2.renderTrusts()],
  ['plans', () => V2.renderPlans()],
  ['calendar', () => V2.renderCalendar()],
  ['inbox', () => V2.renderInbox()],
  ['vault', () => V2.renderVault()],
  ['reports', () => V2.renderReports()],
  ['islamic', () => V2.renderIslamic()],
  ['calm', () => V2.renderCalm()],
  ['settings', () => V2.renderSettings(ctx)],
  ['about', () => V2.renderAbout()],
  ['onboarding', () => V2.renderOnboarding(ctx)],
  ['guide (index)', () => renderGuide(new URLSearchParams())],
  ['guide?p=bad-id', () => renderGuide(new URLSearchParams('p=nope'))],
  ['guide?p=glossary', () => renderGuide(new URLSearchParams('p=glossary'))],
  ['r (scanned request)', () => QR.renderRequest(new URLSearchParams('d=' + QR.encodePayload(
    { v: 1, k: 'respite', f: 'Sara', r: 'I_OWE', u: 'SAR', a: 20000, d: 'Car', nd: '2026-12-01' })))],
  ['r (corrupt code)', () => QR.renderRequest(new URLSearchParams('d=@@@'))],
  ['guide?p=glossary&q=riba', () => renderGuide(new URLSearchParams('p=glossary&q=riba'))],
  ...GUIDE.map(c => ['guide?p=' + c.id, () => renderGuide(new URLSearchParams('p=' + c.id))])
];

const results = [];

async function runPass(label) {
  for (const [name, fn] of ROUTES) {
    try {
      const node = fn();
      if (!node) { results.push({ name, label, ok: false, detail: 'returned nothing' }); continue; }
      const host = document.createElement('div');
      host.style.display = 'none';
      document.body.appendChild(host);
      host.appendChild(node);
      const text = (host.textContent || '').trim();
      const nodes = host.querySelectorAll('*').length;
      host.remove();
      if (nodes < 3 || text.length < 2) {
        results.push({ name, label, ok: false, detail: `thin render: ${nodes} nodes` });
      } else {
        results.push({ name, label, ok: true, detail: `${nodes} nodes` });
      }
    } catch (e) {
      results.push({ name, label, ok: false, detail: e.message });
    }
  }
}

async function main() {
  await S.load();
  if (!S.visibleCommitments().length) await seedDemo();
  await S.load();

  /* Pass 1: English, faith-neutral */
  setLocale('en'); setDigits('latn'); setCalendars('gregory', 'none');
  document.documentElement.dir = 'ltr';
  await runPass('en');

  /* Pass 2: Arabic + RTL + Hijri + Arabic-Indic digits + Islamic mode + Calm */
  await S.saveSettings({ islamic_mode: true, calm_mode: true, spiritual_ledger: true, converted_totals: true });
  setLocale('ar'); setDigits('arab'); setCalendars('islamic-umalqura', 'gregory');
  document.documentElement.dir = 'rtl';
  await runPass('ar+islamic+calm');

  /* Pass 3: empty ledger states */
  setLocale('en'); setDigits('latn'); setCalendars('gregory', 'none');
  document.documentElement.dir = 'ltr';
  await S.saveSettings({ islamic_mode: false, calm_mode: false, converted_totals: false });
  const stash = S.state.commitments;
  S.state.commitments = [];
  await runPass('empty');
  S.state.commitments = stash;

  report();
}

function report() {
  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  const summary = document.getElementById('summary');
  summary.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = `${passed} passed · ${failed} failed · ${results.length} route renders`;
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
    b.textContent = `[${r.label}] ${r.name}`;
    const small = document.createElement('small');
    small.textContent = r.detail || '';
    main.append(b, small);
    row.append(ic, main);
    li.appendChild(row);
    list.appendChild(li);
  }
  document.getElementById('results').replaceChildren(list);
  console.log(`DYON route check: ${passed}/${results.length}`);
  results.filter(r => !r.ok).forEach(r => console.error('ROUTE FAIL:', r.label, r.name, r.detail));
}

main().catch(e => {
  document.getElementById('summary').textContent = 'Harness error: ' + e.message;
  console.error(e);
});
