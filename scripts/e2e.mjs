/* DYON end-to-end scenarios (Playwright, Chromium).
   Usage: node scripts/e2e.mjs [baseUrl]    default http://127.0.0.1:8080/
   Each scenario gets a fresh context (fresh IndexedDB). Failures exit 1. */
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.argv[2] || process.env.DYON_BASE || 'http://127.0.0.1:8080/';
const PHONE = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const results = [];
const browser = await chromium.launch();

async function scenario(name, opts, fn) {
  if (process.env.E2E_ONLY && !name.includes(process.env.E2E_ONLY)) return;
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && !u.protocol.startsWith('data')) errors.push('third-party request: ' + r.url()); });
  try {
    await fn(page);
    if (errors.length) throw new Error(errors.join(' | '));
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, detail: e.message.split('\n')[0] });
    await page.screenshot({ path: `/tmp/e2e-${name.replace(/\W+/g, '_')}.png` }).catch(() => {});
  }
  await ctx.close();
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const rendered = (page) => page.evaluate(() => new Promise(r => document.addEventListener('dyon:rendered', () => r(), { once: true })));

async function boot(page, { onboarded = true, locale = 'en', seed = true } = {}) {
  await page.goto(BASE + 'index.html#/');
  await page.waitForFunction(() => window.DYON && document.getElementById('boot-screen') === null);
  await page.evaluate(async ({ onboarded, locale, seed }) => {
    const S = window.DYON.store;
    await S.saveSettings({ onboarded, locale, digits: 'latn' });
    if (seed && !S.visibleCommitments().length) { const m = await import('./js/seed.js'); await m.seedDemo(); }
    window.DYON.ctx.applyLocale();
  }, { onboarded, locale, seed });
  await page.waitForTimeout(150);
}
async function tourInfo(page) {
  return page.evaluate(async () => (await import('./js/guide.js')).tourInfo());
}

/* 1. onboarding → guide → tour */
await scenario('onboarding → guide → tour (375×812)', PHONE, async (page) => {
  await boot(page, { onboarded: false, seed: false });
  await page.goto(BASE + 'index.html#/');
  await page.waitForFunction(() => location.hash === '#/onboarding');
  // Overview tour is refused before setup is done, with an explanatory toast.
  const started = await page.evaluate(async () => (await import('./js/guide.js')).startTour(0, ''));
  assert(started === false, 'overview tour started during onboarding');
  assert(/Finish setup first/.test(await page.textContent('#toast-wrap')), 'no "finish setup" toast');
  // The onboarding-specific tour runs instead.
  const onb = await page.evaluate(async () => (await import('./js/guide.js')).startTour());
  assert(onb === true, 'onboarding tour did not start');
  assert((await tourInfo(page)).page === 'onboarding', 'wrong tour page');
  await page.keyboard.press('Escape');
  // Guide opens during onboarding and back.
  await page.click('[data-tour="onb-guide"] button');
  await page.waitForFunction(() => location.hash.startsWith('#/guide'));
  await page.goto(BASE + 'index.html#/onboarding');
  await page.click('[data-tour="onb-start"] .btn:not(.btn-primary)');      // skip brain-dump
  await page.click('text=A quick tour of the Overview');
  await page.waitForSelector('.tour-bubble');
  const info = await tourInfo(page);
  assert(info && info.page === '', 'overview tour not running after finishing onboarding');
  const settings = await page.evaluate(() => window.DYON.store.state.settings);
  assert(settings.onboarded === true, 'not onboarded');
});

/* 2. tour + bottom bar */
await scenario('tour bubble stays above the bottom bar; bar is inert', PHONE, async (page) => {
  await boot(page);
  const p = rendered(page);
  await page.evaluate(() => { location.hash = '#/tour'; });
  await p;
  await page.waitForSelector('.tour-bubble');
  for (let i = 0; i < 12; i++) {
    const g = await page.evaluate(() => {
      const b = document.querySelector('.tour-bubble').getBoundingClientRect();
      const bar = document.getElementById('mobile-bar');
      const r = bar.getBoundingClientRect();
      return { bBottom: b.bottom, bTop: b.top, barTop: r.top, inert: bar.hasAttribute('inert'),
        z: [getComputedStyle(bar).zIndex, getComputedStyle(document.querySelector('.tour-bubble')).zIndex, getComputedStyle(document.querySelector('.tour-scrim')).zIndex].map(Number),
        H: innerHeight, docked: document.querySelector('.tour-bubble').classList.contains('docked') };
    });
    assert(g.inert, 'bottom bar not inert');
    assert(g.z[0] < g.z[2] && g.z[1] === 310, 'z-order wrong ' + g.z);
    assert(g.docked, 'bubble not docked on phone');
    assert(g.bTop >= 0 && g.bBottom <= g.H, 'bubble off screen');
    const info = await tourInfo(page);
    if (!(await page.evaluate(() => document.querySelector('.tour-bubble').classList.contains('dock-top'))))
      assert(g.bBottom <= g.barTop + 1, `bubble overlaps the bottom bar (${g.bBottom} > ${g.barTop}) at step ${info.step}`);
    // dock side must not change during a step, even while scrolling
    const before = info.dockTop;
    await page.mouse.wheel(0, 120); await page.waitForTimeout(450);
    const after = (await tourInfo(page)).dockTop;
    assert(before === after, 'dock side flipped during a step');
    const next = await page.$('.tour-bubble .btn-primary');
    const label = await next.textContent();
    if (/guide/i.test(label)) break;
    await next.click(); await page.waitForTimeout(500);
  }
  await page.keyboard.press('Escape');
  assert(!(await page.evaluate(() => document.getElementById('mobile-bar').hasAttribute('inert'))), 'bar stays inert after tour');
});

/* 3. route change ends the tour */
await scenario('leaving the tour page ends the tour', PHONE, async (page) => {
  await boot(page);
  await page.evaluate(async () => (await import('./js/guide.js')).startTour(0, ''));
  await page.waitForSelector('.tour-bubble');
  await page.evaluate(() => { location.hash = '#/ledger'; });
  await page.waitForTimeout(200);
  assert(!(await page.$('.tour-bubble')), 'bubble still shown after route change');
});

/* 4. missing anchors are announced, not silently dropped */
await scenario('missing targets show "not on screen yet" with Skip', PHONE, async (page) => {
  await boot(page);
  await page.evaluate(async () => {
    const gc = await import('./js/guide-content.js');
    gc.TOURS.__test = [
      { sel: '#app-header', title: { en: 'A', ar: 'A' }, body: { en: 'a', ar: 'a' } },
      { sel: '#nope-1', title: { en: 'B', ar: 'B' }, body: { en: 'b', ar: 'b' } },
      { sel: '#nope-2', title: { en: 'C', ar: 'C' }, body: { en: 'c', ar: 'c' } }
    ];
    history.replaceState(null, '', '#/__test');
  });
  await page.evaluate(async () => (await import('./js/guide.js')).startTour(0, '__test'));
  await page.waitForSelector('.tour-bubble');
  assert((await tourInfo(page)).total === 3, 'missing steps were dropped');
  await page.click('.tour-bubble .btn-primary');
  await page.waitForTimeout(100);
  assert(/isn’t on screen yet/.test(await page.textContent('.tour-bubble')), 'no missing message');
  assert(await page.$('.tour-bubble.missing'), 'missing class not set');
});

/* 5. RTL tour */
await scenario('Arabic RTL tour (375×812)', PHONE, async (page) => {
  await boot(page, { locale: 'ar' });
  assert(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'not RTL');
  await page.evaluate(async () => (await import('./js/guide.js')).startTour(0, ''));
  await page.waitForSelector('.tour-bubble');
  const txt = await page.textContent('.tour-bubble');
  assert(/التالي/.test(txt), 'Arabic Next missing');
  const step0 = (await tourInfo(page)).step;
  await page.keyboard.press('ArrowLeft');                 // in RTL ← is "next"
  await page.waitForTimeout(500);
  assert((await tourInfo(page)).step === step0 + 1, 'ArrowLeft did not advance in RTL');
  const g = await page.evaluate(() => { const b = document.querySelector('.tour-bubble').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth; });
  assert(g, 'bubble overflows horizontally');
  assert(await page.evaluate(() => document.title.includes('ديون')), 'title not localised');
});

/* 5b. French tour (T-1.10b) */
await scenario('French tour (375×812)', PHONE, async (page) => {
  await boot(page, { locale: 'fr' });
  const h = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
  assert(h.lang === 'fr' && h.dir === 'ltr', `lang/dir ${h.lang}/${h.dir}`);
  await page.evaluate(async () => (await import('./js/guide.js')).startTour(0, ''));
  await page.waitForSelector('.tour-bubble');
  assert(/Suivant/.test(await page.textContent('.tour-bubble')), 'French "Suivant" missing');
  const step0 = (await tourInfo(page)).step;
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  assert((await tourInfo(page)).step === step0 + 1, 'ArrowRight did not advance');
  const g = await page.evaluate(() => {
    const b = document.querySelector('.tour-bubble'); const r = b.getBoundingClientRect();
    const bar = document.getElementById('mobile-bar').getBoundingClientRect();
    return { ok: r.left >= 0 && r.right <= innerWidth, above: b.classList.contains('dock-top') || r.bottom <= bar.top + 1,
      over: document.documentElement.scrollWidth - innerWidth };
  });
  assert(g.ok && g.over <= 1, 'bubble or page overflows horizontally');
  assert(g.above, 'bubble overlaps the bottom bar');
});

/* 5c. language aside (T-2.5b) */
for (const [label, opts] of [['375×812', PHONE], ['1280×800', { viewport: { width: 1280, height: 800 } }]]) {
  for (const loc of ['en', 'ar']) {
    await scenario(`language aside ${loc} (${label})`, opts, async (page) => {
      await boot(page, { locale: loc });
      const hash0 = await page.evaluate(() => location.hash);
      const hist0 = await page.evaluate(() => history.length);
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.keyboard.press('l');
      await page.waitForSelector('#aside-lang');
      const a = await page.evaluate(() => {
        const p = document.getElementById('aside-lang'); const r = p.getBoundingClientRect();
        return { role: p.getAttribute('role'), modal: p.getAttribute('aria-modal'),
          exp: document.getElementById('lang-toggle').getAttribute('aria-expanded'),
          left: r.left, right: r.right, W: innerWidth, dir: document.documentElement.dir };
      });
      assert(a.role === 'dialog' && a.modal === 'true', 'aside is not a modal dialog');
      assert(a.exp === 'true', 'lang-toggle not aria-expanded');
      if (a.dir === 'rtl') assert(a.left <= 1, `RTL aside not at the left edge (${a.left})`);
      else assert(a.right >= a.W - 1, `LTR aside not at the right edge (${a.right}/${a.W})`);
      await page.fill('#lang-search', 'fran');
      const shown = await page.$$eval('#lang-list button', bs => bs.map(b => b.dataset.lang));
      assert(shown.length === 1 && shown[0] === 'fr', 'filter "fran" → ' + shown.join(','));
      await page.fill('#lang-search', '');
      for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
      assert(await page.evaluate(() => document.getElementById('aside-lang').contains(document.activeElement)), 'focus escaped the aside');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('aside-lang'));
      assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'lang-toggle', 'focus not returned to #lang-toggle');
      const after = await page.evaluate(() => ({ h: location.hash, n: history.length }));
      assert(after.h === hash0 && after.n === hist0, 'aside changed the route or history');
      // choose French
      await page.click('#lang-toggle');
      await page.waitForSelector('#aside-lang');
      await page.click('#lang-list button[data-lang="fr"]');
      await page.waitForFunction(() => document.documentElement.lang === 'fr');
      assert(await page.evaluate(() => window.DYON.store.state.settings.locale_chosen) === true, 'locale_chosen not saved');
      // never auto-switch after an explicit choice
      await page.goto(BASE + 'index.html?lang=en#/');
      await page.waitForFunction(() => window.DYON && document.getElementById('boot-screen') === null);
      await page.waitForTimeout(200);
      assert(await page.evaluate(() => document.documentElement.lang) === 'fr', '?lang=en overrode the chosen language');
    });
  }
}

/* 5d. offline in all three languages (T-2.1b) */
await scenario('works offline in en, ar and fr', { viewport: { width: 1280, height: 800 } }, async (page) => {
  await boot(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 10000 });
  await page.context().setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.DYON && document.getElementById('boot-screen') === null, null, { timeout: 10000 });
  for (const loc of ['ar', 'fr', 'en']) {
    await page.evaluate(async (loc) => { await window.DYON.store.saveSettings({ locale: loc }); await window.DYON.ctx.applyLocale(); }, loc);
    await page.waitForFunction((loc) => document.documentElement.lang === loc, loc, { timeout: 5000 });
    const txt = await page.textContent('#app-header');
    assert(!/\b[a-z]+\.[a-z_]+\b/.test(txt.replace(/dyon\.store/g, '')), `raw key visible offline in ${loc}: ${txt.slice(0, 80)}`);
  }
  await page.context().setOffline(false);
});

/* 6. no horizontal overflow at the three breakpoints, light and dark */
for (const w of [360, 768, 1280]) {
  for (const theme of ['light', 'dark']) {
    await scenario(`no horizontal scroll at ${w}px (${theme})`, { viewport: { width: w, height: 800 } }, async (page) => {
      await boot(page);
      await page.evaluate(async (theme) => { await window.DYON.store.saveSettings({ theme }); window.DYON.ctx.applyTheme(); }, theme);
      for (const loc of ['en', 'ar', 'fr']) {
        await page.evaluate(async (loc) => { await window.DYON.store.saveSettings({ locale: loc }); await window.DYON.ctx.applyLocale(); }, loc);
        for (const r of ['', 'ledger', 'settings', 'guide']) {
          await page.evaluate(r => { location.hash = '#/' + r; }, r);
          await page.waitForTimeout(150);
          const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          assert(over <= 1, `overflow ${over}px on #/${r} (${loc})`);
        }
      }
    });
  }
}

/* 7. §3 country detection — onboarding suggestion appears for the detected country */
await scenario('onboarding suggests Tunisian defaults (timezone Africa/Tunis)',
  { ...PHONE, timezoneId: 'Africa/Tunis', locale: 'en-US' }, async (page) => {
  await page.goto(BASE + 'index.html#/');
  await page.waitForFunction(() => window.DYON && document.getElementById('boot-screen') === null);
  // Force a fresh first run so detection records a suggestion.
  await page.evaluate(async () => {
    const S = window.DYON.store;
    await S.saveSettings({ onboarded: false, country: '', country_applied: false });
    await S.saveProgress({ country_detected: null });
  });
  await page.reload();
  await page.waitForFunction(() => window.DYON && document.getElementById('boot-screen') === null);
  await page.evaluate(() => { location.hash = '#/onboarding'; });
  await page.waitForSelector('#onb-region', { timeout: 5000 });
  const det = await page.evaluate(() => window.DYON.store.state.settings.country_detected);
  assert(det && det.country === 'TN', 'did not detect TN from timezone: ' + JSON.stringify(det));
  const txt = await page.textContent('#onb-region');
  assert(/Tunisia/.test(txt), 'suggestion card does not name Tunisia: ' + txt.slice(0, 80));
});

/* 8. §3 — accepting the suggestion applies TND without turning on Islamic mode */
await scenario('accepting the country suggestion applies TND (not Islamic mode)',
  { ...PHONE, timezoneId: 'Africa/Tunis', locale: 'en-US' }, async (page) => {
  await page.goto(BASE + 'index.html#/');
  await page.waitForFunction(() => window.DYON && document.getElementById('boot-screen') === null);
  await page.evaluate(async () => {
    const S = window.DYON.store;
    await S.saveSettings({ onboarded: false, country: '', country_applied: false, base_currency: 'USD', islamic_mode: false, locale_chosen: false });
    await S.saveProgress({ country_detected: { country: 'TN', source: 'timezone' } });
  });
  await page.evaluate(() => { location.hash = '#/onboarding'; });
  await page.waitForSelector('#onb-region .btn-primary', { timeout: 5000 });
  await page.click('#onb-region .btn-primary');     // "Yes, use these defaults"
  await page.waitForFunction(() => window.DYON.store.state.settings.base_currency === 'TND', null, { timeout: 5000 });
  const s = await page.evaluate(() => window.DYON.store.state.settings);
  assert(s.base_currency === 'TND', 'currency not TND: ' + s.base_currency);
  assert(s.islamic_mode === false, 'islamic_mode was auto-enabled');
});

/* 9. §3 — Settings → Region offers re-apply but does not force it */
await scenario('Settings → Region offers defaults, "Keep my settings" changes nothing',
  { viewport: { width: 1280, height: 800 } }, async (page) => {
  await boot(page);
  await page.evaluate(async () => { await window.DYON.store.saveSettings({ base_currency: 'USD', country: '' }); });
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForSelector('#region-card', { timeout: 5000 });
  await page.click('#region-card .btn');            // open country picker
  await page.waitForSelector('.sheet input[type="search"]', { timeout: 5000 });
  await page.fill('.sheet input[type="search"]', 'France');
  await page.click('.sheet .item-row');             // pick France → confirm sheet
  await page.waitForSelector('.sheet', { timeout: 5000 });
  // Cancel (= "Keep my settings") must leave the currency untouched.
  await page.click('.sheet .btn:not(.btn-primary)');
  await page.waitForTimeout(150);
  const s = await page.evaluate(() => window.DYON.store.state.settings);
  assert(s.country === 'FR', 'country not recorded: ' + s.country);
  assert(s.base_currency === 'USD', 'currency was force-changed to ' + s.base_currency);
});


/* 10. §5 account aside */
const ME_IN = { signed_in: true, name: 'Sam Lee', email: 'sam@example.org', avatar: '/api/avatar.php', created: 1700000000, provider: 'google', providers: ['google'], csrf: 'k'.repeat(32) };
const ME_OUT = { signed_in: false, providers: [], csrf: 'n'.repeat(32) };
const mockMe = (page, body, hits) => page.route('**/api/auth/me.php', r => { if (hits) hits.n++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const aside = (page) => page.evaluate(() => {
  const p = document.getElementById('aside-acct'); if (!p) return null; const r = p.getBoundingClientRect();
  return { role: p.getAttribute('role'), modal: p.getAttribute('aria-modal'), left: r.left, right: r.right, W: innerWidth, dir: document.documentElement.dir,
           exp: document.getElementById('acct-btn').getAttribute('aria-expanded'), over: document.documentElement.scrollWidth - innerWidth, panelOver: p.scrollWidth - p.clientWidth };
});

for (const [label, opts] of [['375×812', PHONE], ['1280×800', { viewport: { width: 1280, height: 800 } }]]) {
  for (const loc of ['en', 'ar', 'fr']) {
    await scenario(`account aside signed out ${loc} (${label})`, opts, async (page) => {
      await mockMe(page, ME_OUT);
      await boot(page, { locale: loc });
      const hash0 = await page.evaluate(() => location.hash), hist0 = await page.evaluate(() => history.length);
      const a0 = await page.evaluate(() => { const b = document.getElementById('acct-btn'); return { c: b.getAttribute('aria-controls'), hp: b.getAttribute('aria-haspopup'), lbl: b.getAttribute('aria-label') }; });
      assert(a0.c === 'aside-acct' && a0.hp === 'dialog' && a0.lbl && a0.lbl.length > 3, 'acct-btn aria wiring: ' + JSON.stringify(a0));
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.keyboard.press('u');
      await page.waitForSelector('#aside-acct');
      await page.waitForTimeout(320);
      const a = await aside(page);
      assert(a.role === 'dialog' && a.modal === 'true' && a.exp === 'true', 'not a modal dialog / not aria-expanded: ' + JSON.stringify(a));
      if (a.dir === 'rtl') assert(a.left <= 1, `RTL aside not at the left edge (${a.left})`); else assert(a.right >= a.W - 1, `LTR aside not at the right edge (${a.right}/${a.W})`);
      assert(a.over <= 1 && a.panelOver <= 1, `horizontal overflow page=${a.over} panel=${a.panelOver}`);
      const txt = await page.textContent('#aside-acct');
      assert(await page.$('#aside-acct #acct-export'), 'Export my data missing when signed out (RL-09)');
      assert(!/\{[a-z_]+\}/i.test(txt), 'unrendered placeholder in panel: ' + txt.slice(0, 80));
      for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
      assert(await page.evaluate(() => document.getElementById('aside-acct').contains(document.activeElement)), 'focus escaped the aside');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('aside-acct'));
      assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'acct-btn', 'focus not returned to #acct-btn');
      assert(await page.evaluate(() => document.getElementById('acct-btn').getAttribute('aria-expanded')) === 'false', 'aria-expanded not reset');
      const after = await page.evaluate(() => ({ h: location.hash, n: history.length }));
      assert(after.h === hash0 && after.n === hist0, 'aside changed the route or history');
      await page.keyboard.press('u'); await page.waitForSelector('#aside-acct'); await page.keyboard.press('u'); // U while open does not stack
      await page.waitForTimeout(100);
      assert((await page.$$('#aside-acct')).length <= 1, 'asides stacked');
    });
  }
}

await scenario('export works with no account and no server (RL-09)', { viewport: { width: 1280, height: 800 }, acceptDownloads: true }, async (page) => {
  await page.route('**/api/**', r => r.abort());                 // static host: the whole API is unreachable
  await boot(page);
  await page.click('#acct-btn'); await page.waitForSelector('#aside-acct #acct-export');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('#aside-acct #acct-export')]);
  assert(/^dyon-backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'bad filename ' + dl.suggestedFilename());
  assert(await page.evaluate(() => !!window.DYON.store.state.settings.onboarded), 'state broken');
});

for (const [label, opts] of [['375×812', PHONE], ['1280×800', { viewport: { width: 1280, height: 800 } }]]) {
  await scenario(`account aside signed in: photo, name, stats, sync dot, sign out (${label})`, opts, async (page) => {
    const hits = { n: 0 }; let signedOut = false, post = null, avatarHits = 0;
    await page.route('**/api/auth/me.php', r => { hits.n++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(signedOut ? ME_OUT : ME_IN) }); });
    await page.route('**/api/avatar.php', r => { avatarHits++; r.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'Cache-Control': 'private, max-age=86400' } }); });
    await page.route('**/api/auth/logout.php', r => { post = { method: r.request().method(), csrf: r.request().headers()['x-csrf-token'] }; signedOut = true; r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
    await boot(page);
    await page.waitForSelector('#acct-btn img.acct-photo', { timeout: 5000 });
    const btn = await page.evaluate(() => { const b = document.getElementById('acct-btn'); const i = b.querySelector('img'); const d = b.querySelector('.sync-dot');
      return { w: i.getBoundingClientRect().width, src: i.getAttribute('src'), dot: d && d.dataset.sync, lbl: b.getAttribute('aria-label') }; });
    assert(btn.src === '/api/avatar.php' && Math.round(btn.w) === 32, 'photo is not the 32px same-origin proxy: ' + JSON.stringify(btn));
    assert(btn.dot === 'off' || btn.dot === 'synced' || btn.dot === 'pending', 'unexpected sync state ' + btn.dot);
    assert(/Sam Lee/.test(btn.lbl), 'aria-label lacks the name: ' + btn.lbl);
    await page.keyboard.press('u'); await page.waitForSelector('#aside-acct #acct-name');
    const body = await page.evaluate(() => ({ name: document.getElementById('acct-name').textContent, email: document.getElementById('acct-email').textContent,
      since: document.getElementById('acct-since')?.textContent, stats: !!document.getElementById('acct-stats'), people: document.querySelectorAll('#acct-stats b')[0]?.textContent,
      sync: document.getElementById('acct-sync').dataset.sync, hero: !!document.querySelector('#aside-acct .acct-hero img.acct-photo') }));
    assert(body.name === 'Sam Lee' && body.email === 'sam@example.org' && /2023/.test(body.since || ''), 'identity wrong: ' + JSON.stringify(body));
    assert(body.stats && Number(body.people) > 0, 'local stats missing/zero: ' + JSON.stringify(body));
    assert(await page.$('#aside-acct a[href="#/settings?s=sync"]') && await page.$('#aside-acct a[href="#/settings?s=devices"]') && await page.$('#aside-acct #acct-export') && await page.$('#aside-acct #acct-signout'), 'links missing');
    assert(avatarHits >= 1 && avatarHits <= 3, 'avatar fetched ' + avatarHits + ' times');
    const ext = await page.evaluate(() => [...document.querySelectorAll('img')].map(i => i.src).filter(u => new URL(u, location.href).origin !== location.origin));
    assert(!ext.length, 'external image: ' + ext.join());
    const colour = await page.evaluate(() => { const d = document.querySelector('#acct-sync .sync-dot'); return getComputedStyle(d).backgroundColor; });
    const [r, g, b] = colour.match(/\d+/g).map(Number); assert(!(r > 180 && g < 90 && b < 90), 'sync dot is red: ' + colour);
    // Calm mode hides the counts
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('aside-acct'));
    await page.evaluate(async () => { await window.DYON.store.saveSettings({ calm_mode: true }); });
    await page.keyboard.press('u'); await page.waitForSelector('#aside-acct #acct-name');
    assert(!(await page.$('#aside-acct #acct-stats')) && await page.$('#aside-acct #acct-stats-hidden'), 'stats not hidden in calm mode');
    await page.click('#acct-signout');
    await page.waitForFunction(() => !document.getElementById('aside-acct'), null, { timeout: 5000 });
    assert(post && post.method === 'POST' && post.csrf === 'k'.repeat(32), 'logout not a POST with the CSRF token: ' + JSON.stringify(post));
    await page.waitForFunction(() => !document.querySelector('#acct-btn img.acct-photo'), null, { timeout: 5000 });
    assert(await page.evaluate(() => window.DYON.store.visibleCommitments().length) > 0, 'sign out touched the ledger');
    assert(!(await page.evaluate(() => window.DYON.store.state.settings.account)), 'local account mirror not removed');
  });
}

await scenario('avatar falls back to the initial when /api/avatar.php is 404', { viewport: { width: 1280, height: 800 } }, async (page) => {
  await mockMe(page, ME_IN);
  await page.route('**/api/avatar.php', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":"no_avatar"}}' }));
  await boot(page);
  await page.waitForSelector('#acct-btn .acct-fallback', { timeout: 5000 });
  assert(await page.textContent('#acct-btn .acct-fallback') === 'S', 'fallback initial wrong');
  assert(!(await page.$('#acct-btn img')), 'broken image left in the header');
  await page.keyboard.press('u'); await page.waitForSelector('#aside-acct .acct-hero .acct-fallback', { timeout: 5000 });
  assert(await page.textContent('#aside-acct .acct-hero .acct-fallback') === 'S', 'aside fallback initial wrong');
});

await scenario('signed-in aside in Arabic: RTL anchoring, Arabic initial, no overflow at 360px', { viewport: { width: 360, height: 740 }, hasTouch: true }, async (page) => {
  await mockMe(page, { ...ME_IN, name: 'أحمد علي', avatar: null });
  await boot(page, { locale: 'ar' });
  await page.waitForSelector('#acct-btn .acct-fallback');
  assert(await page.textContent('#acct-btn .acct-fallback') === 'أ', 'Arabic initial wrong');
  await page.click('#acct-btn'); await page.waitForSelector('#aside-acct #acct-name'); await page.waitForTimeout(320);
  const a = await aside(page);
  assert(a.dir === 'rtl' && a.left <= 1, 'not anchored to the start (left) side in RTL: ' + JSON.stringify(a));
  assert(a.over <= 1 && a.panelOver <= 1, 'overflow at 360px: ' + JSON.stringify(a));
});

await scenario('an OAuth error from the server is shown calmly once and the URL is tidied', { viewport: { width: 1280, height: 800 } }, async (page) => {
  await mockMe(page, ME_OUT);
  await page.goto(BASE + 'index.html?auth_error=state_expired#/');
  await page.waitForFunction(() => window.DYON && document.getElementById('boot-screen') === null);
  await page.evaluate(async () => { await window.DYON.store.saveSettings({ onboarded: true }); window.DYON.ctx.applyLocale(); });
  await page.waitForSelector('.toast', { timeout: 5000 });
  assert(!/state_expired/.test(await page.textContent('.toast')), 'raw error code shown to the user');
  assert(!/auth_error/.test(await page.evaluate(() => location.search)), 'auth_error left in the URL');
});

await scenario('count badges: inbox badge announces its meaning; nothing is red', { viewport: { width: 1280, height: 800 } }, async (page) => {
  await mockMe(page, ME_OUT);
  await boot(page);
  const info = await page.evaluate(() => { const b = document.querySelector('.rail-badge'); if (!b) return null;
    return { lbl: b.getAttribute('aria-label'), role: b.getAttribute('role'), bg: getComputedStyle(b).backgroundColor }; });
  if (info) {
    assert(info.role === 'img' && /\d/.test(info.lbl), 'badge not announced: ' + JSON.stringify(info));
    const [r, g, b] = info.bg.match(/\d+/g).map(Number); assert(!(r > 180 && g < 90 && b < 90), 'badge is red: ' + info.bg);
  }
});

/* ---------- §6.5 storage: Settings card + SSR /storage page ---------- */
await scenario('storage card in Settings: status, usage, "keep my data" (calm answers for granted and declined), link to /storage', { viewport: { width: 375, height: 812 } }, async (page) => {
  await page.addInitScript(() => {
    let persisted = false; window.__persistAnswer = true;
    const sm = { estimate: async () => ({ usage: 3 * 1024 * 1024, quota: 8 * 1024 ** 3 }), persisted: async () => persisted, persist: async () => { if (window.__persistAnswer) persisted = true; return window.__persistAnswer; } };
    Object.defineProperty(navigator, 'storage', { value: sm, configurable: true });
  });
  await boot(page);
  await page.evaluate(() => { location.hash = '#/settings?s=storage'; }); await page.waitForSelector('#storage-card');
  await page.waitForFunction(() => document.getElementById('storage-used')?.textContent.trim().length > 0);
  assert(/MB/.test(await page.textContent('#storage-used')) && /GB/.test(await page.textContent('#storage-used')), 'usage not shown');
  assert(/best-effort/i.test(await page.textContent('#storage-status')), 'status not best-effort');
  assert(await page.isVisible('#storage-keep'), 'keep button hidden');
  await page.evaluate(() => { window.__persistAnswer = false; }); await page.click('#storage-keep');
  await page.waitForFunction(() => !document.getElementById('storage-msg').hidden);
  const declined = await page.textContent('#storage-msg'); assert(/fine|still here/i.test(declined) && !/danger|warning|lose/i.test(declined), 'declined copy not calm: ' + declined);
  await page.evaluate(() => { window.__persistAnswer = true; }); await page.click('#storage-keep');
  await page.waitForFunction(() => /keep DYON/i.test(document.getElementById('storage-msg').textContent));
  await page.waitForFunction(() => document.getElementById('storage-keep').hidden);
  assert(/agreed/i.test(await page.textContent('#storage-status')), 'status did not change after grant');
  assert((await page.getAttribute('#storage-learn', 'href')) === '/storage' && (await page.getAttribute('#data-storage-link', 'href')) === '/storage', 'links to /storage missing');
  const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); assert(!over, 'overflow');
});

for (const [lang, urlp, dir] of [['en', '/storage', 'ltr'], ['ar', '/ar/storage', 'rtl'], ['fr', '/fr/storage', 'ltr']]) {
  for (const [w, h] of [[360, 740], [768, 900], [1280, 800]]) {
    for (const scheme of ['light', 'dark']) {
      await scenario(`/storage ${lang} ${w}px ${scheme}: renders, ${dir}, no overflow, sources linked, panel works`, { viewport: { width: w, height: h }, colorScheme: scheme }, async (page) => {
        await page.addInitScript(() => { Object.defineProperty(navigator, 'storage', { value: { estimate: async () => ({ usage: 2048, quota: 1e9 }), persisted: async () => false, persist: async () => false }, configurable: true }); });
        await page.goto(BASE + urlp.slice(1));
        await page.waitForSelector('#live:not([hidden])', { timeout: 8000 });
        const r = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, over: document.documentElement.scrollWidth > innerWidth + 1,
          links: [...document.querySelectorAll('a[href^="https://"]')].map(a => a.href), h1: document.querySelector('h1')?.textContent.trim().length > 0,
          bg: getComputedStyle(document.body).backgroundColor, small: [...document.querySelectorAll('.btn')].some(b => b.getBoundingClientRect().height < 40 && b.offsetParent) }));
        assert(r.dir === dir && r.lang === lang && !r.over && r.h1 && !r.small, 'layout: ' + JSON.stringify(r));
        assert(r.links.some(u => u.includes('webkit.org/blog/14403')) && r.links.some(u => u.includes('StorageManager/persist')), 'sources missing');
        const lum = r.bg.match(/\d+/g).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3; assert(scheme === 'dark' ? lum < 90 : lum > 200, `${scheme} not applied: ${r.bg}`);
        assert(await page.isVisible('#live-keep'), 'keep button not shown');
        await page.click('#live-keep'); await page.waitForFunction(() => document.getElementById('live-msg').textContent.trim().length > 0);
      });
    }
  }
}

/* ---------- §7 subscribe / confirm / unsubscribe pages (own PHP server + data dir, file mail transport) ---------- */
{
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dyon-e2e-mail-'));
  const port = 19000 + Math.floor(Math.random() * 40);
  const env = { ...process.env, DYON_ENV: 'dev', DYON_COOKIE_SECURE: '0', DYON_DATA_DIR: dataDir, DYON_SECRET_KEY: Buffer.alloc(32, 'f').toString('base64'), DYON_MAIL_TRANSPORT: 'file', DYON_BASE_URL: `http://127.0.0.1:${port}` };
  const srv = spawn('php', ['-S', '127.0.0.1:' + port, '-t', 'public', 'public/router.php'], { env, stdio: 'ignore', detached: false });
  const MB = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(MB + 'api/ping.php')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  const tokenFor = (kind, email) => execFileSync('php', ['-r', `require "app/bootstrap.php"; $r=Dyon\\Db::system()->one("SELECT * FROM subscribers WHERE email=?",["${email}"]); echo Dyon\\Subscribers::token("${kind}",$r);`], { env, encoding: 'utf8' }).trim();
  const freshLimits = () => execFileSync('php', ['-r', 'require "app/bootstrap.php"; Dyon\\Db::system()->exec("DELETE FROM rate_limits");'], { env });   // the per-IP limiter is tested in PHP; e2e reuses one IP
  for (const [lang, pre, dir] of [['en', '', 'ltr'], ['ar', 'ar/', 'rtl'], ['fr', 'fr/', 'ltr']]) {
    for (const [w, h] of [[360, 740], [768, 900], [1280, 800]]) {
      for (const scheme of ['light', 'dark']) {
        await scenario(`/subscribe ${lang} ${w}px ${scheme}: renders ${dir}, no overflow, 44px targets, honeypot hidden, submit → check-your-email notice`, { viewport: { width: w, height: h }, colorScheme: scheme }, async (page) => {
          await page.goto(MB + pre + 'subscribe');
          const r = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, over: document.documentElement.scrollWidth > innerWidth + 1,
            hp: (() => { const e = document.querySelector('input[name=website]'); const b = e.getBoundingClientRect(); return b.width < 2 || b.height < 2 || e.offsetParent === null || b.right < 0 || b.left < -500 || b.left > innerWidth + 500; })(),
            small: [...document.querySelectorAll('.btn, input[type=email]')].some(b => b.getBoundingClientRect().height < 40), bg: getComputedStyle(document.body).backgroundColor }));
          assert(r.dir === dir && r.lang === lang && !r.over && r.hp && !r.small, 'layout: ' + JSON.stringify(r));
          const lum = r.bg.match(/\d+/g).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3; assert(scheme === 'dark' ? lum < 90 : lum > 200, `${scheme} not applied: ${r.bg}`);
          freshLimits(); await page.fill('input[name=email]', `e2e-${lang}-${w}-${scheme}@example.org`); await page.click('button[type=submit]');
          await page.waitForSelector('.msg'); assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'notice overflow');
        });
      }
    }
  }
  for (const [lang, pre, dir] of [['en', '', 'ltr'], ['ar', 'ar/', 'rtl'], ['fr', 'fr/', 'ltr']]) {
    await scenario(`/subscribe → confirm → unsubscribe flow ${lang}: GET changes nothing, POST does, preference centre saves`, { viewport: { width: 360, height: 740 } }, async (page) => {
      const em = `flow-${lang}@example.org`;
      freshLimits(); await page.goto(MB + pre + 'subscribe'); await page.fill('input[name=email]', em); await page.click('button[type=submit]'); await page.waitForSelector('.msg');
      await page.goto(MB + pre + 'subscribe/confirm?t=' + encodeURIComponent(tokenFor('confirm', em)));
      assert(await page.isVisible('form button[type=submit]'), 'confirm button missing');
      await page.click('form button[type=submit]'); await page.waitForSelector('.msg');
      await page.goto(MB + pre + 'unsubscribe?t=' + encodeURIComponent(tokenFor('unsub', em)));
      assert((await page.locator('input[type=checkbox]').count()) === 3 && (await page.evaluate(() => document.documentElement.dir)) === dir, 'preference centre');
      await page.uncheck('input[value=blog]'); await page.click('button[value=save]'); await page.waitForSelector('.msg');
      assert(!(await page.isChecked('input[value=blog]')) && (await page.isChecked('input[value=product]')), 'save did not persist');
      await page.click('button[value=all]'); await page.waitForSelector('.msg');
      const st = execFileSync('php', ['-r', `require "app/bootstrap.php"; echo Dyon\\Db::system()->val("SELECT status FROM subscribers WHERE email=?",["${em}"]);`], { env, encoding: 'utf8' }).trim();
      assert(st === 'unsubscribed', 'status ' + st);
    });
  }
  srv.kill();
}

/* ---------- §6 encrypted sync (own PHP server + data dir; two browser contexts = two devices) ---------- */
{
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dyon-e2e-'));
  const port = 18950 + Math.floor(Math.random() * 40);
  const env = { ...process.env, DYON_ENV: 'dev', DYON_COOKIE_SECURE: '0', DYON_DATA_DIR: dataDir, DYON_SECRET_KEY: Buffer.alloc(32, 'e').toString('base64') };
  const srv = spawn('php', ['-S', '127.0.0.1:' + port, '-t', 'public', 'public/router.php'], { env, stdio: 'ignore', detached: false });
  const SB = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(SB + 'api/ping.php')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  const mkUser = (sub) => JSON.parse(execFileSync('php', ['scripts/e2e-session.php', sub], { env, encoding: 'utf8' }));
  const U = mkUser('sync-e2e');
  const cookies = [{ name: 'dyon_sess', value: U.sess, url: SB }, { name: 'dyon_csrf', value: U.csrf, url: SB }];
  const devs = [];
  const newDevice = async (opts = {}) => {
    const ctx = await browser.newContext(opts); await ctx.addCookies(cookies);
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(SB + 'index.html#/');
    await page.waitForFunction(() => window.DYON && document.getElementById('boot-screen') === null);
    await page.evaluate(async () => { await window.DYON.store.saveSettings({ onboarded: true, locale: 'en', digits: 'latn' }); window.DYON.ctx.applyLocale(); await window.DYON.account.refresh(); });
    devs.push(ctx); return { ctx, page, errors };
  };
  const goSettings = async (page) => { await page.evaluate(() => { location.hash = '#/settings?s=sync'; }); await page.waitForSelector('#sync-card'); await page.waitForTimeout(200); };
  const allServerBytes = () => { const d = path.join(dataDir, 'users'); if (!fs.existsSync(d)) return ''; return fs.readdirSync(d).map(f => fs.readFileSync(path.join(d, f)).toString('latin1')).join('\n'); };
  const PASS = 'correct horse battery staple';
  let A, B, phrase = '';

  await scenario('sync: card offers sign-in when signed out, sync is optional (375×812, ar)', { ...PHONE }, async (page) => {
    await page.goto(SB + 'index.html#/');
    await page.waitForFunction(() => window.DYON && document.getElementById('boot-screen') === null);
    await page.evaluate(async () => { await window.DYON.store.saveSettings({ onboarded: true, locale: 'ar' }); window.DYON.ctx.applyLocale(); });
    await page.evaluate(() => { location.hash = '#/settings?s=sync'; }); await page.waitForSelector('#sync-card');
    const r = await page.evaluate(() => ({ dir: document.documentElement.dir, on: !!document.querySelector('#sync-on'), chip: document.getElementById('net-chip')?.hidden,
      over: document.documentElement.scrollWidth > innerWidth + 1, devices: !!document.querySelector('#devices-card') }));
    assert(r.dir === 'rtl' && !r.on && r.chip === true && !r.over && r.devices, 'signed-out/RTL state wrong: ' + JSON.stringify(r));
    assert(/\S/.test(await page.textContent('#sync-card')), 'empty card');
  });

  await scenario('sync: device A turns sync on — passphrase, 24-word phrase, re-type 3 words, upload', {}, async () => {
    A = await newDevice();
    const p = A.page; await goSettings(p);
    await p.click('#sync-on'); await p.fill('#sync-pass', 'short'); await p.fill('#sync-pass2', 'short'); await p.click('#sync-next');
    assert(/12/.test(await p.textContent('.sheet .err')), 'short passphrase not refused');
    await p.fill('#sync-pass', PASS); await p.fill('#sync-pass2', PASS + 'x'); await p.click('#sync-next');
    assert((await p.textContent('.sheet .err')).trim().length > 0, 'mismatch not refused');
    await p.fill('#sync-pass2', PASS); await p.click('#sync-next');
    await p.waitForSelector('[data-testid="phrase"]', { timeout: 20000 });
    const words = await p.$$eval('[data-testid="phrase"] li span', n => n.map(x => x.textContent));
    assert(words.length === 24, 'phrase not 24 words'); phrase = words.join(' ');
    await p.click('#sync-written');
    const ins = await p.$$('.sheet input[data-n]'); assert(ins.length === 3, 'need 3 check words');
    await ins[0].fill('wrongword'); for (let i = 1; i < 3; i++) await ins[i].fill(words[+(await ins[i].getAttribute('data-n')) - 1]);
    await p.click('#sync-finish'); assert(/match/i.test(await p.textContent('.sheet .err')), 'wrong word accepted');
    for (const i of ins) await i.fill(words[+(await i.getAttribute('data-n')) - 1]);
    await p.click('#sync-finish');
    await p.waitForFunction(() => window.DYON.sync.isEnabled(), null, { timeout: 20000 });
    await p.waitForFunction(() => !document.getElementById('net-chip').hidden);
    assert(await p.evaluate(() => window.DYON.account.syncStatus() !== 'off'), 'dot still off');
  });

  await scenario('sync: A creates a person + debt; B (same account, passphrase) pulls it; server holds no plaintext', {}, async () => {
    const p = A.page;
    await p.evaluate(async () => {
      const S = window.DYON.store;
      await S.createCommitment({ counterparty_name: 'Zainab Secret', direction: 'I_OWE', amount_minor: 5000, unit_code: 'USD', description: 'borrowed-for-roof-77', status: 'active', visibility: 'private' });
      await window.DYON.sync.syncNow();
    });
    assert(await p.evaluate(() => window.DYON.sync.pendingCount()) === 0, 'A still has pending changes');
    B = await newDevice(); await goSettings(B.page);
    await B.page.click('#sync-join'); await B.page.fill('#sync-secret', 'wrong passphrase here'); await B.page.click('#sync-join-go');
    await B.page.waitForFunction(() => document.querySelector('.sheet .err')?.textContent.trim().length > 0, null, { timeout: 20000 });
    assert(!(await B.page.evaluate(() => window.DYON.sync.isEnabled())), 'wrong passphrase connected');
    await B.page.fill('#sync-secret', PASS); await B.page.click('#sync-join-go');
    await B.page.waitForFunction(() => window.DYON.sync.isEnabled(), null, { timeout: 20000 });
    await B.page.evaluate(() => window.DYON.sync.syncNow());
    const got = await B.page.evaluate(() => { const S = window.DYON.store.state; return { c: S.commitments.map(c => c.description), p: S.counterparties.map(c => c.alias), audit: S.audit.some(a => a.action === 'sync.apply') }; });
    assert(got.c.includes('borrowed-for-roof-77') && got.p.includes('Zainab Secret'), 'B did not get the data: ' + JSON.stringify(got));
    assert(got.audit, 'no sync.apply audit event on B');
    const raw = allServerBytes(); assert(raw.length > 0, 'no server file');
    for (const needle of ['Zainab', 'borrowed-for-roof', 'amount_minor', 'counterparty']) assert(!raw.includes(needle), 'plaintext on server: ' + needle);
    const sys = fs.readFileSync(path.join(dataDir, 'system.sqlite')).toString('latin1'); assert(!sys.includes('Zainab') && !sys.includes(PASS), 'system db leaks');
    const users = fs.readdirSync(path.join(dataDir, 'users')).filter(f => f.endsWith('.sqlite')); assert(users.length === 1 && !users[0].startsWith(U.user + '.'), 'user file naming');
    assert((fs.statSync(path.join(dataDir, 'users', users[0])).mode & 0o777) === 0o600, 'user file not 0600');
  });

  await scenario('sync: spiritual and audit never leave the device; local edit syncs by itself within seconds', {}, async () => {
    await A.page.evaluate(async () => { const S = window.DYON.store; await S.db.put('spiritual', { id: 'sp_secret', note: 'dua-private-xyz', created_at: Date.now() }); });
    const c = await A.page.evaluate(async () => { const S = window.DYON.store; const x = S.state.commitments[0]; await S.updateCommitment(x.id, { description: 'edited-on-A-auto' }); return x.id; });
    await B.page.waitForFunction(async (id) => { await window.DYON.sync.syncNow(); return window.DYON.store.state.commitments.find(x => x.id === id)?.description === 'edited-on-A-auto'; }, c, { timeout: 25000 });
    const raw = allServerBytes(); assert(!raw.includes('dua-private'), 'spiritual leaked');
    assert(await B.page.evaluate(() => !window.DYON.store.state.spiritual.some(s => s.id === 'sp_secret')), 'spiritual reached B');
    await A.page.waitForFunction(() => window.DYON.sync.pendingCount() === 0, null, { timeout: 15000 }).catch(() => {});
    assert(await A.page.evaluate(() => window.DYON.sync.pendingCount()) === 0, 'A pending after auto-sync: ' + JSON.stringify(await A.page.evaluate(() => window.DYON.sync.status())));
  });

  await scenario('sync: both edit the amount offline → newer kept, other value one tap away in "Needs a look"; nothing lost', {}, async () => {
    const id = await A.page.evaluate(() => window.DYON.store.state.commitments[0].id);
    await A.ctx.setOffline(true); await B.ctx.setOffline(true);
    await A.page.evaluate(async (id) => { await window.DYON.store.updateCommitment(id, { amount_minor: 11100 }); }, id);
    await B.page.waitForTimeout(30);
    await B.page.evaluate(async (id) => { await window.DYON.store.updateCommitment(id, { amount_minor: 22200 }); }, id);
    assert(await A.page.evaluate(() => window.DYON.sync.status().phase) === 'offline', 'A not offline');
    assert(await A.page.evaluate(() => window.DYON.account.syncStatus()) === 'offline', 'dot not offline');
    assert(await A.page.evaluate(() => document.getElementById('net-chip').dataset.state) === 'offline', 'chip not offline');
    await A.ctx.setOffline(false); await B.ctx.setOffline(false);
    await A.page.evaluate(() => window.DYON.sync.syncNow()); await B.page.evaluate(() => window.DYON.sync.syncNow());
    await A.page.evaluate(() => window.DYON.sync.syncNow());
    const b = await B.page.evaluate((id) => ({ amt: window.DYON.store.state.commitments.find(x => x.id === id).amount_minor, n: window.DYON.sync.conflicts().length }), id);
    assert(b.n === 1 && b.amt === 22200, 'B should keep its newer 222.00 and list one conflict: ' + JSON.stringify(b));
    const a = await A.page.evaluate((id) => window.DYON.store.state.commitments.find(x => x.id === id).amount_minor, id);
    assert(a === 22200, 'A did not converge on the newer value: ' + a);
    await B.page.evaluate(() => { location.hash = '#/settings?s=sync'; }); await B.page.waitForSelector('[data-testid="conflicts-link"]');
    await B.page.click('[data-testid="conflicts-link"]'); await B.page.waitForSelector('[data-conflict]');
    const txt = await B.page.textContent('[data-conflict]'); assert(/111/.test(txt) && /222/.test(txt), 'both values not shown: ' + txt);
    await B.page.click('[data-conflict] [data-act="other"]'); await B.page.waitForSelector('[data-testid="no-conflicts"]');
    assert(await B.page.evaluate((id) => window.DYON.store.state.commitments.find(x => x.id === id).amount_minor, id) === 11100, 'other value not applied');
    await B.page.evaluate(() => window.DYON.sync.syncNow()); await A.page.evaluate(() => window.DYON.sync.syncNow());
    assert(await A.page.evaluate((id) => window.DYON.store.state.commitments.find(x => x.id === id).amount_minor, id) === 11100, 'choice did not sync to A');
  });

  await scenario('sync: a different-field edit on both devices merges silently (no conflict)', {}, async () => {
    const id = await A.page.evaluate(() => window.DYON.store.state.commitments[0].id);
    await A.page.evaluate(async (id) => { await window.DYON.store.updateCommitment(id, { notes: 'note-from-A' }); }, id);
    await B.page.evaluate(async (id) => { await window.DYON.store.updateCommitment(id, { description: 'desc-from-B' }); }, id);
    for (const pg of [A.page, B.page, A.page, B.page]) await pg.evaluate(() => window.DYON.sync.syncNow());
    for (const pg of [A.page, B.page]) {
      const r = await pg.evaluate((id) => { const c = window.DYON.store.state.commitments.find(x => x.id === id); return [c.notes, c.description, window.DYON.sync.conflicts().length]; }, id);
      assert(r[0] === 'note-from-A' && r[1] === 'desc-from-B' && r[2] === 0, 'merge failed: ' + JSON.stringify(r));
    }
  });

  await scenario('sync: devices card lists both; B removes A → A is cut off (403) and keeps its local data', {}, async () => {
    await goSettings(B.page); await B.page.waitForSelector('#devices-card [data-device]');
    assert((await B.page.$$('#devices-card [data-device]')).length === 2, 'expected 2 devices');
    const aId = await A.page.evaluate(() => window.DYON.sync.status().deviceId);
    await B.page.evaluate((id) => window.DYON.sync.revokeDevice(id), aId);
    await A.page.evaluate(async () => { await window.DYON.store.updateCommitment(window.DYON.store.state.commitments[0].id, { notes: 'after-revoke' }); await window.DYON.sync.syncNow(); });
    await A.page.waitForFunction(() => !window.DYON.sync.isEnabled(), null, { timeout: 10000 });
    const left = await A.page.evaluate(() => window.DYON.store.state.commitments.length);
    assert(left >= 1, 'A lost its local data'); 
    await goSettings(A.page); assert(/removed from sync/i.test(await A.page.textContent('#sync-card')), 'no revoked notice');
  });

  await scenario('sync: turning sync off keeps local data; server copy stays; delete-copy needs the word and wipes the file', {}, async () => {
    const before = await B.page.evaluate(() => window.DYON.store.state.commitments.length);
    await goSettings(B.page); await B.page.click('#sync-off'); await B.page.click('.sheet .btn-primary');
    await B.page.waitForFunction(() => !window.DYON.sync.isEnabled());
    assert(await B.page.evaluate(() => window.DYON.store.state.commitments.length) === before, 'turning off changed local data');
    assert(fs.readdirSync(path.join(dataDir, 'users')).some(f => f.endsWith('.sqlite')), 'server copy vanished');
    await B.page.evaluate(() => window.DYON.sync.syncNow());   // no-op when off
    // re-join, then wipe server copy
    await goSettings(B.page); await B.page.click('#sync-join'); await B.page.fill('#sync-secret', PASS); await B.page.click('#sync-join-go');
    await B.page.waitForFunction(() => window.DYON.sync.isEnabled(), null, { timeout: 20000 });
    await goSettings(B.page); await B.page.click('#sync-wipe'); await B.page.fill('#wipe-word', 'nope'); await B.page.click('.sheet .btn-danger');
    assert(await B.page.evaluate(() => window.DYON.sync.isEnabled()), 'wiped without confirmation word');
    await B.page.fill('#wipe-word', 'delete'); await B.page.click('.sheet .btn-danger');
    await B.page.waitForFunction(() => !window.DYON.sync.isEnabled());
    assert(!fs.existsSync(path.join(dataDir, 'users')) || fs.readdirSync(path.join(dataDir, 'users')).filter(f => f.endsWith('.sqlite')).length === 0, 'server file still there');
    assert(await B.page.evaluate(() => window.DYON.store.state.commitments.length) === before, 'wipe touched local data');
  });

  await scenario('sync: "Delete all data" on a synced device turns sync off and still works with no network (RL-09)', {}, async () => {
    const D = await newDevice(); await goSettings(D.page);
    await D.page.click('#sync-on'); await D.page.fill('#sync-pass', PASS); await D.page.fill('#sync-pass2', PASS); await D.page.click('#sync-next');
    await D.page.waitForSelector('[data-testid="phrase"]', { timeout: 20000 });
    const words = await D.page.$$eval('[data-testid="phrase"] li span', n => n.map(x => x.textContent));
    await D.page.click('#sync-written'); for (const i of await D.page.$$('.sheet input[data-n]')) await i.fill(words[+(await i.getAttribute('data-n')) - 1]);
    await D.page.click('#sync-finish'); await D.page.waitForFunction(() => window.DYON.sync.isEnabled(), null, { timeout: 20000 });
    await D.ctx.setOffline(true);
    await D.page.evaluate(async () => { await window.DYON.store.wipe(); });
    await D.page.waitForFunction(() => !window.DYON.sync.isEnabled());
    assert(await D.page.evaluate(() => window.DYON.store.state.commitments.length) === 0, 'wipe did not clear');
    // export is a pure local function: works offline, signed in or not
    assert(await D.page.evaluate(() => JSON.parse(JSON.stringify(window.DYON.store.exportPayload(false))).app === 'DYON'), 'export failed offline');
  });

  for (const c of devs) await c.close().catch(() => {});
  srv.kill('SIGTERM'); fs.rmSync(dataDir, { recursive: true, force: true });
}


await browser.close();
const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
console.log(`e2e: ${results.length - failed.length} passed · ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
